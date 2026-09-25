"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, Lock, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
  MOCK_PAYROLL_RUNS,
  MOCK_PAYROLL_LOCKS,
  MOCK_PAYROLL_DISPUTES,
  MOCK_FUNDING_RESERVATIONS,
  MOCK_EXPORTED_AUDIT_TIMELINE_RUN_IDS,
} from "@/lib/api/mockData";
import { buildPeriodCloseChecklist } from "@/lib/reconciliation/periodClose";
import { usePeriodCloseStore } from "@/stores/periodClose";
import EmptyState from "@/components/ui/EmptyState";
import type { PayrollRun, PeriodCloseChecklistItem } from "@/types/models";

function ChecklistRow({ item }: { item: PeriodCloseChecklistItem }) {
  return (
    <li className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{item.label}</span>
        {item.isSatisfied ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            Clear
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
            <XCircle className="w-4 h-4" aria-hidden="true" />
            Blocked
          </span>
        )}
      </div>
      {item.blockers.length > 0 && (
        <ul className="mt-2 space-y-1">
          {item.blockers.map((blocker, i) => (
            <li key={i} className="text-xs text-red-600 pl-5 relative before:content-['•'] before:absolute before:left-1">
              {blocker.description}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PeriodCloseCard({ run }: { run: PayrollRun }) {
  const closePeriod = usePeriodCloseStore((s) => s.closePeriod);
  const isClosed = usePeriodCloseStore((s) => s.isClosed(run.id));
  const [error, setError] = useState<string | null>(null);

  const checklist = useMemo(
    () =>
      buildPeriodCloseChecklist({
        payrollRunId: run.id,
        locks: MOCK_PAYROLL_LOCKS,
        disputes: MOCK_PAYROLL_DISPUTES,
        reservations: MOCK_FUNDING_RESERVATIONS,
        exportedAuditTimelineRunIds: MOCK_EXPORTED_AUDIT_TIMELINE_RUN_IDS,
      }),
    [run.id],
  );

  const handleClose = () => {
    const result = closePeriod({
      payrollRunId: run.id,
      locks: MOCK_PAYROLL_LOCKS,
      disputes: MOCK_PAYROLL_DISPUTES,
      reservations: MOCK_FUNDING_RESERVATIONS,
      exportedAuditTimelineRunIds: MOCK_EXPORTED_AUDIT_TIMELINE_RUN_IDS,
    });

    if (!result.success) {
      setError(result.error);
      return;
    }
    setError(null);
    toast.success("Payroll period closed", {
      description: `${run.id} has been marked closed.`,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4" data-testid={`period-close-card-${run.id}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{run.id}</h3>
          <p className="text-xs text-gray-500">
            ${run.totalAmount.toLocaleString()} · {run.employeeCount} employees
          </p>
        </div>
        {isClosed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-medium">
            <Lock className="w-3 h-3" aria-hidden="true" />
            Closed
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {checklist.items.map((item) => (
          <ChecklistRow key={item.category} item={item} />
        ))}
      </ul>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!isClosed && (
        <button
          type="button"
          onClick={handleClose}
          disabled={!checklist.canClose}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {checklist.canClose ? "Close period" : "Resolve blockers to close"}
        </button>
      )}
    </div>
  );
}

function PeriodCloseDashboard({ runs = MOCK_PAYROLL_RUNS }: { runs?: PayrollRun[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No payroll periods to reconcile"
        description="Payroll periods will appear here once a run has been processed."
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="period-close-dashboard">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Period Close Reconciliation</h2>
        <p className="text-sm text-gray-500 mt-1">
          Close a payroll period only after holds, disputes, funding reservations, and audit
          references are reconciled.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {runs.map((run) => (
          <PeriodCloseCard key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
}

export default PeriodCloseDashboard;
