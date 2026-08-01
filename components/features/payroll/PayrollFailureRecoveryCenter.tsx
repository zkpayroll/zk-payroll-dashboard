"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, XCircle, RotateCcw, Ban, ChevronDown, ChevronUp } from "lucide-react";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { PayrollRun } from "@/types";

type FailureGroup = {
  reasonKey: string;
  reasonLabel: string;
  runs: PayrollRun[];
};

function classifyFailure(run: PayrollRun): { key: string; label: string } {
  if (run.reconciliationStatus === "failed") {
    return { key: "reconciliation_failed", label: "Reconciliation failed" };
  }
  if (run.reconciliationDetails?.discrepancies?.length) {
    return { key: "discrepancies", label: "Discrepancies found during reconciliation" };
  }
  if (run.status === "failed") {
    return { key: "submission_failed", label: "Transaction submission failed" };
  }
  return { key: "unknown", label: "Unknown failure" };
}

export default function PayrollFailureRecoveryCenter() {
  const [runs, setRuns] = useState<PayrollRun[]>(() =>
    MOCK_PAYROLL_RUNS.filter(
      (r) => r.status === "failed" || r.reconciliationStatus === "failed",
    ),
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const groups = useMemo<FailureGroup[]>(() => {
    const map = new Map<string, FailureGroup>();
    for (const run of runs) {
      const { key, label } = classifyFailure(run);
      if (!map.has(key)) {
        map.set(key, { reasonKey: key, reasonLabel: label, runs: [] });
      }
      map.get(key)!.runs.push(run);
    }
    return Array.from(map.values());
  }, [runs]);

  async function updateStatus(runId: string, status: "pending" | "cancelled") {
    setPendingAction(runId + status);
    setActionError(null);
    try {
      const res = await fetch(`/api/payroll/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        throw new Error("Request failed");
      }
      setRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch {
      setActionError(
        `Failed to ${status === "pending" ? "retry" : "cancel"} run ${runId}. Please try again.`,
      );
    } finally {
      setPendingAction(null);
    }
  }

  if (runs.length === 0) {
    return (
      <section
        aria-labelledby="recovery-heading"
        className="rounded-lg bg-white p-6 shadow-sm"
      >
        <h2 id="recovery-heading" className="text-base font-semibold text-gray-900">
          Payroll failure recovery center
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          No failed payroll runs — everything is running smoothly.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="recovery-heading"
      className="rounded-lg bg-white p-6 shadow-sm"
    >
      <h2 id="recovery-heading" className="mb-1 text-base font-semibold text-gray-900">
        Payroll failure recovery center{" "}
        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          {runs.length}
        </span>
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Failed payroll runs grouped by cause. Retry re-queues the run; cancel marks it as
        cancelled and stops further processing.
      </p>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          const isOpen = expanded[group.reasonKey] ?? true;
          return (
            <div key={group.reasonKey} className="rounded-lg border border-gray-200">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [group.reasonKey]: !isOpen }))
                }
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden />
                  {group.reasonLabel}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {group.runs.length}
                  </span>
                </span>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden />
                )}
              </button>

              {isOpen && (
                <ul className="space-y-2 border-t border-gray-100 p-4" aria-label={group.reasonLabel}>
                  {group.runs.map((run) => (
                    <li
                      key={run.id}
                      className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                          <span className="text-sm font-medium text-gray-900">
                            Run {run.id}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          ${run.totalAmount.toLocaleString()} · {run.employeeCount} employee(s) ·{" "}
                          {new Date(run.timestamp).toLocaleDateString()}
                        </p>
                        {run.reconciliationDetails?.discrepancies?.length ? (
                          <p className="mt-1 text-xs text-gray-600">
                            {run.reconciliationDetails.discrepancies.join("; ")}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={pendingAction === run.id + "pending"}
                          onClick={() => updateStatus(run.id, "pending")}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden />
                          {pendingAction === run.id + "pending" ? "Retrying…" : "Retry"}
                        </button>
                        <button
                          type="button"
                          disabled={pendingAction === run.id + "cancelled"}
                          onClick={() => updateStatus(run.id, "cancelled")}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          <Ban className="h-3 w-3" aria-hidden />
                          {pendingAction === run.id + "cancelled" ? "Cancelling…" : "Cancel"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}