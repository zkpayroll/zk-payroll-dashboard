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
} from "lucide-react";

type RetryDecisionOutcome = "allowed" | "blocked" | "deferred";

interface RetryDecisionLogEntry {
  id: string;
  payrollId: string;
  outcome: RetryDecisionOutcome;
  reason: string;
  attempt: number;
  timestamp: string;
}

const RETRY_DECISION_REASON_LABELS: Record<RetryDecisionOutcome, string> = {
  allowed: "Retry permitted",
  blocked: "Retry blocked",
  deferred: "Retry deferred",
};

function evaluateRetryDecision(
  payrollId: string,
  attempt: number,
  isMutationDisabled: boolean,
): Omit<RetryDecisionLogEntry, "id" | "timestamp"> {
  if (isMutationDisabled) {
    return {
      payrollId,
      outcome: "blocked",
      reason: "CONTRACT_PAUSED",
      attempt,
    };
  }
  if (attempt > 3) {
    return {
      payrollId,
      outcome: "deferred",
      reason: "MAX_ATTEMPTS_EXCEEDED",
      attempt,
    };
  }
  return {
    payrollId,
    outcome: "allowed",
    reason: "RETRY_WITHIN_POLICY",
    attempt,
  };
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

  const recordRetryDecision = useCallback(
    (payrollId: string, attempt: number) => {
      const decision = evaluateRetryDecision(
        payrollId,
        attempt,
        isMutationDisabled,
      );
      setRetryDecisionLog((prev) => [
        {
          ...decision,
          id: `${payrollId}-${attempt}-${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [isMutationDisabled],
  );

  const activeConcurrentConflict = useMemo(() => {
    return (
      Object.values(evaluations).find(
        (e) => e.hasConflict && !dismissedPayrollIds[e.warnings[0]?.payrollId],
      ) ?? null
    );
  }, [evaluations, dismissedPayrollIds]);

  const runs = useMemo(() => MOCK_PAYROLL_RUNS, []);

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

        {/* Contract Paused Alert Banner */}
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

        {/* Concurrent Payroll Edit Warnings */}
        {activeConcurrentConflict && (
          <ConcurrentPayrollEditWarningBanner
            evaluation={activeConcurrentConflict}
            onDismiss={() => {
              const payrollId = activeConcurrentConflict.warnings[0]?.payrollId;
              if (payrollId) dismissWarning(payrollId);
            }}
          />
        )}

        {/* Retry Policy Decision Log */}
        <div
          data-testid="retry-decision-log"
          className="bg-white rounded-lg shadow-sm border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Retry Policy Decisions
            </h2>
            <span className="text-xs text-gray-500">
              {retryDecisionLog.length} recorded
            </span>
          </div>
          {retryDecisionLog.length === 0 ? (
            <p className="text-xs text-gray-500">
              No retry decisions recorded yet. Retry evaluations will appear
              here with privacy-safe identifiers only.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
              {retryDecisionLog.map((entry) => (
                <li
                  key={entry.id}
                  data-testid="retry-decision-entry"
                  className="p-3 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
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
                        {RETRY_DECISION_REASON_LABELS[entry.outcome]}
                      </span>
                    </div>
                    <p className="text-gray-500">
                      {entry.reason} · attempt {entry.attempt}
                    </p>
                  </div>
                  <span className="text-gray-400">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
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
                  onClick={() => recordRetryDecision(run.id, 1)}
                  className="ml-3 text-xs font-medium text-gray-600 hover:text-indigo-700 underline"
                >
                  Log Retry Decision
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
