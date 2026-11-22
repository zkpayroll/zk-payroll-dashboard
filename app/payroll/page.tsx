"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useContractPauseGuard } from "@/hooks/useContractPauseGuard";
import { usePayrollConcurrencyStore } from "@/stores/payrollConcurrency";
import { ConcurrentPayrollEditWarningBanner } from "@/components/payroll/ConcurrentPayrollEditWarningBanner";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import {
  AlertTriangle,
  Play,
  Plus,
  ClipboardList,
  Shield,
  Clock,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  Building2,
  RotateCcw,
} from "lucide-react";
import { evaluatePayrollRunCompany } from "@/lib/payroll/inactiveCompanyWarning";
import {
  evaluatePayoutBatchRetryGuidance,
  type PayoutBatchRetryGuidance,
  type RetryDecisionOutcome,
  type PayoutBatchRetryEvaluationInput,
  RETRY_DECISION_OUTCOME_LABELS,
} from "@/lib/payroll/payoutBatchRetryGuidance";
import type { PayrollRun } from "@/types";

interface RetryDecisionLogEntry extends PayoutBatchRetryGuidance {
  id: string;
  timestamp: string;
}

const RETRY_DECISION_REASON_LABELS: Record<RetryDecisionOutcome, string> =
  RETRY_DECISION_OUTCOME_LABELS;

function evaluateRetryDecision(
  payrollId: string,
  attempt: number,
  isMutationDisabled: boolean,
  options: Partial<PayoutBatchRetryEvaluationInput> = {},
): Omit<RetryDecisionLogEntry, "id" | "timestamp"> {
  return evaluatePayoutBatchRetryGuidance({
    payrollId,
    attempt,
    isMutationDisabled,
    isPayoutTokenPaused: options.isPayoutTokenPaused,
    pauseReason: options.pauseReason,
    hasInactiveCompany: options.hasInactiveCompany,
    isSettled: options.isSettled,
    receiptId: options.receiptId,
    transactionHash: options.transactionHash,
    status: options.status,
    cancellationReason: options.cancellationReason,
    reconciliationStatus: options.reconciliationStatus,
    discrepancies: options.discrepancies,
  });
}

const POST_SUBMISSION_ADJUSTMENT_LIMIT = 3;

interface PostSubmissionAdjustmentState {
  payrollId: string;
  adjustmentsUsed: number;
  lastAdjustedAt: string | null;
}

function getAdjustmentLimitError(adjustmentsUsed: number): string | null {
  if (adjustmentsUsed >= POST_SUBMISSION_ADJUSTMENT_LIMIT) {
    return `Adjustment limit reached (${POST_SUBMISSION_ADJUSTMENT_LIMIT} per payroll run). Contact an approver to request a new batch.`;
  }
  return null;
}

export default function PayrollDashboardPage() {
  const { isMutationDisabled, pauseReason, remediationHref } =
    useContractPauseGuard();

  const evaluations = usePayrollConcurrencyStore((s) => s.evaluations);
  const dismissedPayrollIds = usePayrollConcurrencyStore((s) => s.dismissedPayrollIds);
  const dismissWarning = usePayrollConcurrencyStore((s) => s.dismissWarning);

  const [retryDecisionLog, setRetryDecisionLog] = useState<
    RetryDecisionLogEntry[]
  >([]);

  const [retryAttempts, setRetryAttempts] = useState<Record<string, number>>({});

  const [adjustmentState, setAdjustmentState] = useState<
    Record<string, PostSubmissionAdjustmentState>
  >({});

  const runs = useMemo(() => MOCK_PAYROLL_RUNS, []);

  const recordRetryDecision = useCallback(
    (target: PayrollRun | string, attemptOverride?: number) => {
      const isRunObject = typeof target === "object" && target !== null;
      const payrollId = isRunObject ? target.id : target;
      const nextAttempt =
        attemptOverride ?? ((retryAttempts[payrollId] ?? 0) + 1);

      setRetryAttempts((prev) => ({ ...prev, [payrollId]: nextAttempt }));

      const run = isRunObject
        ? target
        : runs.find((r) => r.id === payrollId);

      const hasInactiveCompany = run
        ? evaluatePayrollRunCompany(run).hasWarning
        : false;

      const isSettled = run
        ? Boolean(run.receiptId || run.status === "verified")
        : false;

      const decision = evaluateRetryDecision(
        payrollId,
        nextAttempt,
        isMutationDisabled,
        {
          pauseReason,
          isPayoutTokenPaused: run?.payoutTokenPaused,
          hasInactiveCompany,
          isSettled,
          receiptId: run?.receiptId,
          transactionHash: run?.transactionHash,
          status: run?.status,
          cancellationReason: run?.cancellationReason,
          reconciliationStatus: run?.reconciliationStatus,
          discrepancies: run?.reconciliationDetails?.discrepancies,
        },
      );

      setRetryDecisionLog((prev) => [
        {
          ...decision,
          id: `${payrollId}-${nextAttempt}-${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [isMutationDisabled, pauseReason, retryAttempts, runs],
  );

  const recordAdjustment = useCallback(
    (payrollId: string) => {
      if (isMutationDisabled) {
        return {
          ok: false as const,
          error: "Adjustments are disabled while payroll contracts are paused.",
        };
      }
      const current = adjustmentState[payrollId] ?? {
        payrollId,
        adjustmentsUsed: 0,
        lastAdjustedAt: null,
      };
      const limitError = getAdjustmentLimitError(current.adjustmentsUsed);
      if (limitError) {
        return { ok: false as const, error: limitError };
      }
      setAdjustmentState((prev) => ({
        ...prev,
        [payrollId]: {
          payrollId,
          adjustmentsUsed: current.adjustmentsUsed + 1,
          lastAdjustedAt: new Date().toISOString(),
        },
      }));
      return { ok: true as const };
    },
    [adjustmentState, isMutationDisabled],
  );

  const activeConcurrentConflict = useMemo(() => {
    return (
      Object.values(evaluations).find(
        (e) => e.hasConflict && !dismissedPayrollIds[e.warnings[0]?.payrollId],
      ) ?? null
    );
  }, [evaluations, dismissedPayrollIds]);

  const inactiveCompanyRunsCount = useMemo(() => {
    return runs.filter((r) => evaluatePayrollRunCompany(r).hasWarning).length;
  }, [runs]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Payroll Operations
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage batch payroll dispatches, approvals, and on-chain
              settlement verifications.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/payroll/verify"
              className="px-3.5 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 shadow-sm"
            >
              <Shield className="w-4 h-4 text-indigo-600" />
              Verify Proof
            </Link>
          </div>
        </div>

        
        {isMutationDisabled && (
          <div
            role="alert"
            data-testid="contract-paused-alert"
            className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-amber-900">
                    Smart Contracts Paused — Mutation Actions Disabled
                  </h3>
                  <span
                    data-testid="error-code-badge"
                    className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-200 text-amber-800"
                  >
                    CONTRACT_PAUSED
                  </span>
                </div>
                <p className="text-sm text-amber-700 mt-1">
                  {pauseReason
                    ? `Contract pause reason: ${pauseReason}. Mutation actions (batch creation, execution, and approvals) are disabled until resumed.`
                    : "Payroll smart contract operations are currently paused by administrative action. Mutation actions are suspended to prevent inconsistent state."}
                </p>
                <div className="mt-3 flex items-center gap-4 flex-wrap">
                  <Link
                    href={remediationHref}
                    className="text-xs font-semibold text-amber-800 underline hover:text-amber-900"
                  >
                    Review Pause Status in Admin Settings
                  </Link>
                  <span className="text-xs text-amber-600">
                    Zero private data leakage: individual salaries and addresses
                    are never exposed.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

       
        <div
          data-testid="adjustment-limits-panel"
          className="bg-white rounded-lg shadow-sm border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              Post-Submission Adjustments
            </h2>
            <span className="text-xs text-gray-500">
              Limit: {POST_SUBMISSION_ADJUSTMENT_LIMIT} per run
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Adjustments after submission are capped to protect payroll
            integrity. Privacy-safe identifiers only; no salary or address data
            is exposed.
          </p>
        </div>

       
        {activeConcurrentConflict && (
          <ConcurrentPayrollEditWarningBanner
            evaluation={activeConcurrentConflict}
            onDismiss={() => {
              const payrollId = activeConcurrentConflict.warnings[0]?.payrollId;
              if (payrollId) dismissWarning(payrollId);
            }}
          />
        )}

        {/* Inactive Company Reference Alert (#762) */}
        {inactiveCompanyRunsCount > 0 && (
          <div
            role="alert"
            data-testid="inactive-company-runs-alert"
            className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Building2
                className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-rose-900">
                  Inactive Company References Detected
                </h3>
                <p className="text-sm text-rose-700 mt-1">
                  {inactiveCompanyRunsCount} payroll run(s) reference an inactive
                  company. Payout execution and disbursements are restricted until
                  the referenced company is reactivated.
                </p>
                <div className="mt-2">
                  <Link
                    href="/company/switch"
                    className="text-xs font-semibold text-rose-800 underline hover:text-rose-900"
                  >
                    Switch company context or review company status
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Retry Policy Decision Log */}
        <div
          data-testid="retry-decision-log"
          className="bg-white rounded-lg shadow-sm border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-600" />
              Retry Policy Decisions
            </h2>
            <span className="text-xs text-gray-500">
              {retryDecisionLog.length} recorded
            </span>
          </div>
          {retryDecisionLog.length === 0 ? (
            <p className="text-xs text-gray-500">
              No retry decisions recorded yet. Retry evaluations will appear
              here with privacy-safe identifiers and actionable operator guidance.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
              {retryDecisionLog.map((entry) => (
                <li
                  key={entry.id}
                  data-testid="retry-decision-entry"
                  className="p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-medium text-gray-900">
                        {entry.payrollId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${
                          entry.outcome === "allowed"
                            ? "bg-green-100 text-green-700"
                            : entry.outcome === "blocked"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {RETRY_DECISION_REASON_LABELS[entry.outcome] ?? entry.outcome}
                      </span>
                      <span className="text-gray-500 font-mono text-[11px]">
                        {entry.reason} · attempt {entry.attempt} of {entry.maxAttempts}
                      </span>
                    </div>
                    <span className="text-gray-400 shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {entry.guidance && (
                    <div
                      data-testid={`retry-guidance-${entry.payrollId}`}
                      className="rounded-md bg-gray-50 border border-gray-200 p-2.5 text-xs text-gray-800 space-y-1.5"
                    >
                      <p
                        data-testid={`retry-guidance-text-${entry.payrollId}`}
                        className="font-medium"
                      >
                        {entry.guidance}
                      </p>
                      {entry.nextSteps && entry.nextSteps.length > 0 && (
                        <div className="mt-1">
                          <p className="font-semibold text-gray-600 text-[11px] uppercase tracking-wider">
                            Next Steps:
                          </p>
                          <ol
                            data-testid={`retry-guidance-next-steps-${entry.payrollId}`}
                            className="list-decimal pl-4 mt-0.5 space-y-0.5 text-gray-600 text-[11px]"
                          >
                            {entry.nextSteps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {entry.remediationHref && (
                        <div className="pt-1">
                          <Link
                            href={entry.remediationHref}
                            className="text-xs font-semibold text-indigo-600 underline hover:text-indigo-800 inline-flex items-center gap-1"
                          >
                            {entry.remediationLabel ?? "Take Action"}
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action Controls Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Payroll Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Create Batch */}
            {isMutationDisabled ? (
              <button
                type="button"
                disabled
                aria-disabled="true"
                data-testid="create-batch-action"
                title="Creation disabled: Payroll contracts are paused."
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-75 text-left"
              >
                <div className="p-2 rounded-md bg-gray-200 text-gray-400 shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
                    Create Draft Batch
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  </p>
                  <p className="text-xs text-amber-700">Paused by contracts</p>
                </div>
              </button>
            ) : (
              <Link
                href="/payroll/create"
                data-testid="create-batch-action"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left"
              >
                <div className="p-2 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                    Create Draft Batch
                  </p>
                  <p className="text-xs text-gray-500">
                    Configure a new payroll disbursement
                  </p>
                </div>
              </Link>
            )}

            {/* Execute Payroll */}
            {isMutationDisabled ? (
              <button
                type="button"
                disabled
                aria-disabled="true"
                data-testid="execute-payroll-action"
                title="Execution disabled: Payroll contracts are paused."
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-75 text-left"
              >
                <div className="p-2 rounded-md bg-gray-200 text-gray-400 shrink-0">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
                    Execute Payroll
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  </p>
                  <p className="text-xs text-amber-700">Paused by contracts</p>
                </div>
              </button>
            ) : (
              <Link
                href="/payroll/execute"
                data-testid="execute-payroll-action"
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left"
              >
                <div className="p-2 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 shrink-0">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                    Execute Payroll
                  </p>
                  <p className="text-xs text-gray-500">
                    Process approved batches to chain
                  </p>
                </div>
              </Link>
            )}

            {/* Approval Queue */}
            <Link
              href="/payroll/approvals"
              data-testid="approval-queue-action"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left"
            >
              <div className="p-2 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 shrink-0">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                  Approval Queue
                </p>
                <p className="text-xs text-gray-500">
                  Review and sign off on pending drafts
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Payroll Runs Overview */}
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Active Payroll Runs
            </h2>
            <span className="text-xs text-gray-500">
              {runs.length} total runs
            </span>
          </div>

          <div className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
            {runs.map((run) => (
              <div
                key={run.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {run.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        run.status === "verified"
                          ? "bg-green-100 text-green-700"
                          : run.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : run.status === "paused"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {run.status}
                    </span>
                    {evaluatePayrollRunCompany(run).hasWarning && (
                      <span
                        data-testid={`inactive-company-badge-${run.id}`}
                        className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-700"
                        title="Referenced company is inactive"
                      >
                        Inactive Company
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {run.createdAt ? new Date(run.createdAt).toLocaleDateString() : "Pending"}
                    </span>
                    <span>{run.employeeCount} recipients</span>
                  </div>
                </div>

                <Link
                  href={`/payroll/${run.id}`}
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View Details
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  data-testid={`retry-decision-${run.id}`}
                  onClick={() => recordRetryDecision(run)}
                  className="ml-3 text-xs font-medium text-gray-600 hover:text-indigo-700 underline"
                >
                  Log Retry Decision
                </button>
                {(() => {
                  const state = adjustmentState[run.id];
                  const used = state?.adjustmentsUsed ?? 0;
                  const limitError = getAdjustmentLimitError(used);
                  return (
                    <div className="ml-3 flex items-center gap-2">
                      <span
                        data-testid={`adjustment-count-${run.id}`}
                        className="text-xs text-gray-500"
                      >
                        {used}/{POST_SUBMISSION_ADJUSTMENT_LIMIT} adjustments
                      </span>
                      <button
                        type="button"
                        data-testid={`adjustment-action-${run.id}`}
                        disabled={Boolean(limitError) || isMutationDisabled}
                        aria-disabled={Boolean(limitError) || isMutationDisabled}
                        title={
                          limitError ??
                          (isMutationDisabled
                            ? "Adjustments disabled: Payroll contracts are paused."
                            : "Request a post-submission adjustment")
                        }
                        onClick={() => recordAdjustment(run.id)}
                        className="text-xs font-medium text-gray-600 hover:text-indigo-700 underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        Adjust
                      </button>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
