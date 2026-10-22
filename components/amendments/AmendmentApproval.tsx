"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  Lock,
  EyeOff,
  AlertTriangle,
} from "lucides-react";
import {
  fetchAmendmentById,
  validateAmendmentPlan,
} from "@/lib/sdk/amendments";
import type { SalaryCommitmentAmendment } from "@/lib/sdk/amendments";
import AmendmentDiff from "./AmendmentDiff";
import { AMENDMENT_PRIVACY_NOTICE } from "@/lib/privacy/amendments";

type LoadState = "loading" | "loaded" | "error" | "empty" | "approving" | "approved" | "failed" | "blocked";

export interface AmendmentApprovalProps {
  amendmentId: string;
  amendment?: SalaryCommitmentAmendment | null;
  initialState?: LoadState;
}

// Post-submission adjustment limits applied in the dashboard layer.
// These guardrails prevent operators from approving amendments that exceed
// safe operational bounds after the amendment has already been submitted.
export const MAX_APPROVAL_ATTEMPTS = 3;
export const MAX_ADJUSTMENT_WINDOW_HOURS = 72;

export interface AdjustmentLimitResult {
  isAllowed: boolean;
  reason?: string;
  remainingAttempts?: number;
}

/**
 * Evaluates the post-submission adjustment limits for an amendment.
 * This is pure and deterministic so it can be tested and reused by the dashboard.
 */
export function evaluateAdjustmentLimits(
  amendment: SalaryCommitmentAmendment,
  now: Date = new Date(),
): AdjustmentLimitResult {
  const attempts = amendment.adjustmentAttempts ?? 0;
  if (attempts >= MAX_APPROVAL_ATTEMPTS) {
    return {
      isAllowed: false,
      remainingAttempts: 0,
      reason: `Approval attempt limit reached (${MAX_APPROVAL_ATTEMPTS}). Request a new amendment instead.`,
    };
  }

  const submittedAt = amendment.submittedAt ? new Date(amendment.submittedAt) : null;
  if (submittedAt && !Number.isNaN(submittedAt.getTime())) {
    const hoursSinceSubmission = (now.getTime() - submittedAt.getTime()) / (3600 * 1000);
    if (hoursSinceSubmission > MAX_ADJUSTMENT_WINDOW_HOURS) {
      return {
        isAllowed: false,
        remainingAttempts: MAX_APPROVAL_ATTEMPTS - attempts,
        reason: `Adjustment window of ${MAX_ADJUSTMENT_WINDOW_HOURS}h has expired. Request a fresh amendment.`,
      };
    }
  }

  return {
    isAllowed: true,
    remainingAttempts: MAX_APPROVAL_ATTEMPTS - attempts,
  };
}

export function AmendmentApproval({
  amendmentId,
  amendment: propAmendment,
  initialState,
}: AmendmentApprovalProps) {
  const [amendment, setAmendment] = useState<SalaryCommitmentAmendment | null | undefined>(
    propAmendment !== undefined ? propAmendment : undefined,
  );
  const [state, setState] = useState<LoadState>(
    initialState ??
      (propAmendment !== undefined
        ? propAmendment
          ? propAmendment.approvalStatus === "approved"
            ? "approved"
            : propAmendment.approvalStatus === "failed"
              ? "failed"
              : validateAmendmentPlan(propAmendment).isBlocked
                ? "blocked"
                : "loaded"
          : "empty"
        : "loading"),
  );
  const [approvalError, setApprovalError] = useState<string | null>(null);

  useEffect(() => {
    if (propAmendment !== undefined) {
      setAmendment(propAmendment);
      if (initialState) return;
      if (propAmendment === null) setState("empty");
      else if (propAmendment) {
        const v = validateAmendmentPlan(propAmendment);
        if (propAmendment.approvalStatus === "approved") setState("approved");
        else if (propAmendment.approvalStatus === "failed") setState("failed");
        else if (v.isBlocked) setState("blocked");
        else setState("loaded");
      }
      return;
    }
    if (initialState) return;
    let cancelled = false;
    setState("loading");
    fetchAmendmentById(amendmentId)
      .then((data) => {
        if (cancelled) return;
        setAmendment(data);
        if (!data) {
          setState("empty");
          return;
        }
        const v = validateAmendmentPlan(data);
        if (data.approvalStatus === "approved") setState("approved");
        else if (data.approvalStatus === "failed") setState("failed");
        else if (v.isBlocked) setState("blocked");
        else setState("loaded");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [amendmentId, propAmendment, initialState]);

  const adjustmentLimits = useMemo(() => {
    if (!amendment) return null;
    return evaluateAdjustmentLimits(amendment);
  }, [amendment]);

  const handleApprove = async () => {
    if (!amendment) return;
    const validation = validateAmendmentPlan(amendment);
    if (!validation.canApprove) return;
    const limits = evaluateAdjustmentLimits(amendment);
    if (!limits.isAllowed) {
      setApprovalError(limits.reason ?? "Adjustment limit blocked approval.");
      setState("blocked");
      return;
    }
    setState("approving");
    setApprovalError(null);
    // Simulate SDK approval call with validation gate
    await new Promise((resolve) => setTimeout(resolve, 600));
    // Mock: approve succeeds for valid pending amendments
    if (validation.canApprove) {
      setState("approved");
    } else {
      setApprovalError("Approval blocked by SGK validation.");
      setState("blocked");
    }
  };

  if (state === "loading" || state === "approving") {
    return (
      <div
        data-testid={state === "approving" ? "amendment-approving" : "amendment-approval-loading"}
        aria-label={state === "approving" ? "Approving amendment" : "Loading approval screen"}
        className="space-y-4"
      >
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse space-y-4">
          <div className="h5 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-24 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-200 rounded w-40" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        data-testid="amendment-approval-error"
        role="alert"
        className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3"
      >
        <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-red-800">Failed to load amendment</p>
          <p className="text-sm text-red-700 mt-1">Could not fetch amendment {amendmentId}.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (state === "empty" || !amendment) {
    return (
      <div data-testid="amendment-approval-empty" className="bg-white rounded-xl border border-dashed p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">Amendment not found</h3>
        <p className="text-sm text-gray-500 mt-1">The requested amendment does not exist.</p>
        <Link
          href="/payroll/amendments"
          className="mt-4 inline-flex px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          Back to amendments
        </Link>
      </div>
    );
  }

  const validation = validateAmendmentPlan(amendment);
  const limitsBlocked = adjustmentLimits !== null && !adjustmentLimits.isAllowed;

  // Approved state
  if (state === "approved") {
    return (
      <section data-testid="amendment-approved-state" aria-labelledby="approval-heading" className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 id="approval-heading" className="text-base font-semibold text-green-900">
              Amendment approved
            </h2>
            <p className="text-sm text-green-700 mt-1">
              {validation.nextSteps ?? "New commitment is active. Salary values remain encrypted."}
            </p>
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1.5">
              <EyeOff className="h-3 w-3" aria-hidden="true" />
              Privacy preserved — raw salary never exposed.
            </p>
          </div>
        </div>

        <AmendmentDiff amendment={{ ...amendment, approvalStatus: "approved" }} />

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/payroll/amendments/${amendment.id}`}
            className="inline-flex items-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View amendment
          </Link>
          <Link
            href="/payroll/amendments"
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Back to list
          </Link>
        </div>
      </section>
    );
  }

  // Failed state
  if (state === "failed") {
    return (
      <section data-testid="amendment-failed-state" role="alert" className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <XCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-red-900">Amendment failed</h2>
            <p className="text-sm text-red-700 mt-1">{validation.blockedReason}</p>
            <p className="text-xs text-red-600 mt-2">{validation.nextSteps}</p>
          </div>
        </div>

        <AmendmentDiff amendment={amendment} />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setState("loaded")}
            className="inline-flex items-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            data-testid="amendment-retry-button"
          >
            Retry review
          </button>
          <Link
            href="/payroll/amendments"
            className="inline-flex items-center px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
          >
            Back to list
          </Link>
        </div>
      </section>
    );
  }

  // Blocked state (stale, policy-invalid, or post-submission adjustment limit)
  if (state === "blocked" || validation.isBlocked || limitsBlocked) {
    const blockedReason =
      limitsBlocked && !validation.isBlocked
        ? (adjustmentLimits ?? {}).reason ?? approvalError
        : validation.blockedReason;
    const blockedTitle =
      limitsBlocked && !validation.isBlocked
        ? "Adjustment limit reached — approval blocked"
        : validation.isStale
          ? "Stale commitment — approval blocked"
          : !validation.isPolicyValid
            ? "Policy violation — approval blocked"
            : "Approval blocked";

    return (
      <section
        data-testid="amendment-blocked-state"
        aria-labelledby="blocked-heading"
        className="space-y-6"
      >
        <Link
          href={`/payroll/amendments/${amendment.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to detail
        </Link>

        <div
          data-testid="amendment-blocked"
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3"
        >
          <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 id="blocked-heading" className="text-base font-semibold text-red-900">
              {blockedTitle}
            </h2>
            <p className="text-sm text-red-700 mt-1">{blockedReason}</p>
            {validation.nextSteps && (
              <p className="text-sm text-red-600 mt-2">{validation.nextSteps}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-red-600">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>SGK validation prevents approval of stale, policy-invalid, or over-limit plans.</span>
            </div>
          </div>
        </div>

        <AmendmentDiff amendment={amendment} />

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-amber-800">Required next steps</h3>
          <p className="text-sm text-amber-700 mt-1">{validation.nextSteps}</p>
          <ul className="mt-2 text-xs text-amber-700 list-disc list-inside space-y-1">
            {validation.isStale && <li>Request a fresh amendment with the latest commitment version.</li>}
            {!validation.isPolicyValid && <li>Correct the amendment to meet asset, period, or threshold policy.</li>}
            {limitsBlocked && (
              <li>
                Post-submission adjustment limits: max {MAX_APPROVAL_ATTEMPTS} attempts within {MAX_ADJUSTMENT_WINDOW_HOURS}h of submission.
              </li>
            )}
            <li>Salary values stay encrypted — only hashes and safe metadata are reviewed.</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            aria-disabled="true"
            data-testid="amendment-approve-disabled"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-gray-100 text-gray-400 text-sm font-medium cursor-not-allowed"
          >
            <Lock className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Approval blocked
          </button>
          <Link
            href={`/payroll/amendments/${amendment.id}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to detail
          </Link>
        </div>

        <footer className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <EyeOff className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{AMENDMENT_PRIVACY_NOTICE}</span>
        </footer>
      </section>
    );
  }

  // Loaded state — ready for review and approval
  return (
    <section data-testid="amendment-approval" aria-labelledby="approval-heading" className="space-y-6">
      <Link
        href={`/payroll/amendments/${amendment.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to detail
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 id="approval-heading" className="text-lg font-semibold text-gray-900">
          Review amendment
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Approving will activate the new salary commitment. Raw salary values remain encrypted.
        </p>
      </div>

      <AmendmentDiff amendment={amendment} />

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-800">Post-submission adjustment limits</h3>
        <ul className="mt-2 text-xs text-gray-600 list-disc list-inside space-y-1">
          <li>Max {MAX_APPROVAL_ATTEMPTS} approval attempts</li>
          <li>Adjustment window: {MAX_ADJUSTMENT_WINDOW_HOURS} hours from submission</li>
          {adjustmentLimits && (
            <li data-testid="adjustment-remaining">
              Remaining attempts: {adjustmentLimits.remainingAttempts ?? 0}
            </li>
          )}
        </ul>
      </div>

      {approvalError && (
        <div data-testid="amendment-approval-error-message" role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{approvalError}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={!validation.canApprove||!!approvalError}
          data-testid="amendment-approve-button"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Approve amendment
        </button>
        <Link
          href={`/payroll/amendments/${amendment.id}`}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>

      <footer className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{AMENDMENT_PRIVACY_NOTICE}</span>
      </footer>
    </section>
  );
}
