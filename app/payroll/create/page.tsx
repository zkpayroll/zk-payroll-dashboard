"use client";

import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { AssetSymbolInput } from "@/components/features/assets/AssetSymbolInput";
import BatchReferenceInput from "@/components/features/payroll/BatchReferenceInput";
import { normalizeAssetSymbol } from "@/lib/assets/normalizeAssetSymbol";
import { validateBatchReferenceWithDuplicateCheck } from "@/lib/validation/batchReference";
import DraftDescriptionInput from "@/components/payroll/DraftDescriptionInput";
import { validateDraftDescription } from "@/lib/validation/draftDescription";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import { Coins, Shield, UserCheck, AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useContractPauseGuard } from "@hooks/useContractPauseGuard";
import {
  RetryPolicyDecisionLog,
  type RetryPolicyDecisionEntry,
  type RetryReasonCode,
} from "@/lib/payroll/retryPolicyDecisionLog";

// Known batch references for duplicate guidance — demo uses mock run ids plus example refs
const KNOWN_BATCH_REFERENCES = [...MOCK_PAYROLL_RUNS.map((r) => r.id), "BATCH-2025-001", "payroll_q1_2025"];

/**
 * Payroll operator permission model.
 *
 * The dashboard must validate that the current operator holds the
 * `create:payroll` permission before allowing a draft batch to be
 * created. This is a privacy-aware gate: we only expose the operator's
 * role label and the missing permission, never salary or amount data.
 */
export type PayrollPermission = "create:payroll" | "view:payroll" | "approve:payroll";

export type PayrollOperatorRole = "admin" | "operator" | "viewer" | "guest";

export interface PayrollOperator {
  id: string;
  name: string;
  role: PayrollOperatorRole;
  permissions: PayrollPermission[];
}

/**
 * Role → permission matrix used to derive effective permissions.
 * Keeping this explicit makes the gate auditable and easy to test.
 */
export const ROLE_PERMISSIONS: Record<PayrollOperatorRole, PayrollPermission[]> = {
  admin: ["create:payroll", "view:payroll", "approve:payroll"],
  operator: ["create:payroll", "view:payroll"],
  viewer: ["view:payroll"],
  guest: [],
};

export interface PermissionCheckResult {
  allowed: boolean;
  operator: PayrollOperator;
  required: PayrollPermission;
  message: string;
}

/**
 * Validate whether an operator may create a payroll batch.
 *
 * Returns an actionable message when denied so the UI can surface
 * clear guidance to the operator without leaking sensitive data.
 */
export function validatePayrollOperatorPermission(
  operator: PayrollOperator,
  required: PayrollPermission = "create:payroll",
): PermissionCheckResult {
  if (!operator || typeof operator.id !== "string" || operator.id.trim().length === 0) {
    return {
      allowed: false,
      operator,
      required,
      message: "No payroll operator is signed in. Sign in with an operator account to create a payroll batch.",
    };
  }

  if (!operator.role || !(operator.role in ROLE_PERMISSIONS)) {
    return {
      allowed: false,
      operator,
      required,
      message: `Unknown payroll role "${operator.role}". Contact an administrator to assign a valid role.`,
    };
  }

  const effective = new Set([
    ...(ROLE_PERMISSIONS[operator.role] ?? []),
    ...(Array.isArray(operator.permissions) ? operator.permissions : []),
  ]);

  if (!effective.has(required)) {
    return {
      allowed: false,
      operator,
      required,
      message: `Operator "${operator.name || operator.id}" with role "${operator.role}" lacks the "${required}" permission required to create a payroll batch.`,
    };
  }

  return {
    allowed: true,
    operator,
    required,
    message: `Operator "${operator.name || operator.id}" is authorized to create payroll batches.`,
  };
}

/**
 * Default operator used by the dashboard when no explicit operator id
 * is provided. This mirrors the demo auth session and keeps the flow
 * working without a real backend.
 */
export const DEFAULT_PAYROLL_OPERATOR: PayrollOperator = {
  id: "operator-demo-001",
  name: "Demo Operator",
  role: "operator",
  permissions: [],
};

export default function PayrollCreatePage() {
  const [assetRaw, setAssetRaw] = useState("");
  const [batchRef, setBatchRef] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState<{ asset: string; batchRef: string; description: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryLog] = useState(() => new RetryPolicyDecisionLog());
  const [lastRetryDecision, setLastRetryDecision] = useState<RetryPolicyDecisionEntry | null>(null);

  // The operator driving this dashboard session. In a live app this would
  // come from the auth context; the default keeps the demo flow working.
  const operator = DEFAULT_PAYROLL_OPERATOR;

  const { isMutationDisabled, checkAction } = useContractPauseGuard();

  const permissionCheck = useMemo(
    () => validatePayrollOperatorPermission(operator, "create:payroll"),
    [operator],
  );

  /**
   * Record a retry policy decision and surface it to the operator.
   * The log is privacy-safe: only opaque ids and decision metadata.
   */
  const recordRetryDecision = (
    reasonCode: RetryReasonCode,
    retryable: boolean,
    message: string,
    batchReference?: string,
  ) => {
    try {
      const entry = retryLog.record({
        operatorId: operator.id,
        batchReference,
        retryable,
        reasonCode,
        message,
      });
      setLastRetryDecision(entry);
      return entry;
    } catch (decisionError) {
      // Logging must never block the payroll flow. Surface the failure
      // to the operator so it is actionable but keep the flow alive.
      const message2 =
        decisionError instanceof Error ? decisionError.message : "Unknown retry decision logging error.";
      setLastRetryDecision({
        id: "retry-dec-error",
        timestamp: new Date().toISOString(),
        decision: "blocked",
        retryable: false,
        reasonCode: reasonCode,
        message: `Retry decision could not be logged: ${message2} Contact support if this persists.`,
        operatorId: operator.id,
      });
      return null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefact();

    // Contract pause gate: deny mutation actions when contracts are paused
    const pauseCheck = checkAction("create_payroll_draft");
    if (!pauseCheck.allowed) {
      setError(pauseCheck.message);
      setSubmitted(null);
      recordRetryDecision("contract_paused", false, pauseCheck.message, batchRef);
      return;
    }

    // Permission gate first: deny before any field work is done.
    if (!permissionCheck.allowed) {
      setError(permissionCheck.message);
      setSubmitted(null);
      recordRetryDecision("permission_denied", false, permissionCheck.message, batchRef);
      return;
    }

    const assetResult = normalizeAssetSymbol(assetRaw);
    if (!assetResult.isValid) {
      setError(assetResult.validationError);
      setSubmitted(null);
      recordRetryDecision("invalid_asset", true, assetResult.validationError, batchRef);
      return;
    }
    const batchResult = validateBatchReferenceWithDuplicateCheck(batchRef, KNOWN_BATCH_REFERENCES);
    if (!batchResult.isValid) {
      setError(batchResult.message);
      setSubmitted(null);
      recordRetryDecision("invalid_batch_reference", true, batchResult.message, batchRef);
      return;
    }
    const descriptionResult = validateDraftDescription(description);
    if (!descriptionResult.isValid) {
      setError(descriptionResult.message);
      setSubmitted(null);
      recordRetryDecision("invalid_description", true, descriptionResult.message, batchRef);
      return;
    }
    setError(null);
    // Privacy-safe: only normalized asset + batch reference (opaque ID) — no amounts
    setSubmitted({ asset: assetResult.normalized, batchRef: batchResult.normalized, description: description });
    recordRetryDecision(
      "validation_passed",
      true,
      "Draft batch validation passed; subsequent submission attempts are retryable.",
      batchResult.normalized,
    );
  };

  const result = normalizeAssetSymbol(assetRaw);
  const batchValidation = useMemo(
    () => validateBatchReferenceWithDuplicateCheck(batchRef, KNOWN_BATCH_REFERENCES),
    [batchRef],
  );
  const descriptionValidation = useMemo(
    () => validateDraftDescription(description),
    [description],
  );

  return (
    <DashboardLayout>
      <div className="max-w-2l mx-auto space-y-6">
        <header className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <Coins className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Create Payroll Batch</h1>
              <p className="text-sm text-gray-500 mt-0.5">Enter asset details — symbols are normalized for consistency before submission.</p>
            </div>
          </div>
        </header>

        <div data-testid="payroll-operator-permission" className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm">
            {permissionCheck.allowed ? (
              <>
                <UserCheck className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">
                  Operator: <span className="font-medium">{operator.name || operator.id}</span> (<span className="font-mono">{operator.role}</span>)— authorized to create payroll batches.
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-red-700" data-testid="payroll-operator-denied">
                  {permissionCheck.message}
                </span>
              </>
            )}
          </div>
        </div>

        {isMutationDisabled && (
          <div
            role="alert"
            data-testid="contract-paused-alert"
            className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-900"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-medium">
                Payroll smart contracts are currently paused. Batch creation and other mutation actions are disabled.
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <AssetSymbolInput value={assetRaw} onChange={(raw) => setAssetRaw(raw)} />

          <BatchReferenceInput
            value={batchRef}
            onChange={setBatchRef}
            existingReferences={KNOWN_BATCH_REFERENCES}
            label="External batch reference"
            placeholder="e.g. BATCH-2025-001"
          />

          <DraftDescriptionInput
            value={description}
            onChange={setDescription}
          />

          <div className="rounded-lg bg-gray-50 border p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Privacy & validation
            </p>
            <p>Asset raw: <span className="font-mono">{assetRaw || "—"}</span> → <span className="font-mono font-medium">{result.normalized || "—"}</span> {result.isValid ? "✓" : `x● ${result.validationError}`} {result.wasNormalized && <span className="text-amber-700">(trimmed/uppercased)</span>}</p>
            <p>Batch ref: <span className="font-mono">{batchRef || "—"}</span> → <span className="font-mono font-medium">{batchValidation.normalized || "—"}</span> {batchValidation.isValid ? "✓ valid" : `x● ${batchValidation.message}`}</p>
            <p>Description: <span className="font-mono">{description || "—"}</span> {descriptionValidation.isValid ? "✓ valid" : `● ${descriptionValidation.message}`}</p>
            <p className="text-gray-500 mt-1">Helper copy is shown under each field. Duplicates like <span className="font-mono">BATCH-2025-001</span> or <span className="font-mono">tx_001</span> are flagged before submission.</p>
            {result.wasNormalized && <p className="text-amber-700 mt-1">Asset warning shown: symbol will be normalized before submission.</p>}
          </div>

          {error && (
            <div role="alert" data-testid="payroll-create-error" className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {submitted && (
            <div
              data-testid="payroll-create-success"
              role="status"
              className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800"
            >
              Payroll batch draft created for asset <span className="font-mono font-semibold">{submitted.asset}</span> with reference <span className="font-mono font-semibold">{submitted.batchRef}</span>. Normalized values will be used for on-chain submission.
            </div>
          )}

          {lastRetryDecision && (
            <div
              data-testid="payroll-retry-decision"
              data-decision={lastRetryDecision.decision}
              data-reason-code={lastRetryDecision.reasonCode}
              role="status"
              aria-live="polite"
              className={
                lastRetryDecision.retryable
                  ? "rounded-md bg-sky-50 border border-sky-200 p-3 text-sm text-sky-900"
                  : "rounded-md bg-slate-50 border border-slate-200 p-3 text-sm text-slate-900"
              }
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span className="font-medium">
                  Retry policy: {lastRetryDecision.retryable ? "allowed" : "blocked"}
                </span>
                <span className="font-mono text-xs">({lastRetryDecision.reasonCode})</span>
              </div>
              <p className="mt-1">{lastRetryDecision.message}</p>
              <p className="mt-1 text-xs opacity-70">
                Decision logged at {lastRetryDecision.timestamp} for operator <span className="font-mono">{lastRetryDecision.operatorId}</span>.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!permissionCheck.allowed || isMutationDisabled}
              aria-disabled={!permissionCheck.allowed || isMutationDisabled}
              title={isMutationDisabled ? "Disabled: Payroll contracts are paused" : undefined}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="payroll-create-submit"
            >
              Create draft batch
            </button>
            <Link
              href="/payroll/drafts"
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View drafts
            </Link>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
