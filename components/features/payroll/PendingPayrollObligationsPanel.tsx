import Link from "next/link";
import { CalendarClock, ClipboardList } from "lucide-react";
import type { PayrollRun } from "@/types/models";
import { formatPeriodLabel } from "@/lib/date/periodLabel";

interface PendingPayrollObligationsPanelProps {
  runs: PayrollRun[];
}

function getPendingRuns(runs: PayrollRun[]): PayrollRun[] {
  return runs.filter(
    (run) =>
      run.status !== "cancelled" &&
      (run.status === "pending" || run.approvalStatus === "pending_executive_approval"),
  );
}

/** A privacy-safe queue of payroll runs still awaiting an operational step. */
export function PendingPayrollObligationsPanel({ runs }: PendingPayrollObligationsPanelProps) {
  const pendingRuns = getPendingRuns(runs);

  return (
    <section
      aria-labelledby="pending-obligations-heading"
      data-testid="pending-payroll-obligations"
      className="mb-6 rounded-xl border border-indigo-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700" aria-hidden="true">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h2 id="pending-obligations-heading" className="text-base font-semibold text-gray-900">
              Pending payroll obligations
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {pendingRuns.length} payroll run{pendingRuns.length === 1 ? " needs" : "s need"} review or execution. Amounts and employee details stay hidden here.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700" aria-label={`${pendingRuns.length} pending payroll obligations`}>
          {pendingRuns.length} pending
        </span>
      </div>

      {pendingRuns.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
          No pending payroll obligations.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100" aria-label="Pending payroll runs">
          {pendingRuns.map((run) => (
            <li key={run.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarClock className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{formatPeriodLabel(run.createdAt)}</p>
                  <p className="text-xs text-gray-500">{run.employeeCount} recipient{run.employeeCount === 1 ? "" : "s"} · {run.approvalStatus === "pending_executive_approval" ? "Awaiting approval" : "Awaiting processing"}</p>
                </div>
              </div>
              <Link href={`/payroll/${encodeURIComponent(run.id)}`} className="text-sm font-medium text-indigo-700 underline-offset-2 hover:underline">
                Review run
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PendingPayrollObligationsPanel;
