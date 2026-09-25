import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  UserRound,
} from "lucide-react";
import {
  filterValidPayrollIssueHandoffs,
  type PayrollIssueHandoffItem,
} from "@/src/issues";

export interface PayrollIssueHandoffPanelProps {
  issues?: PayrollIssueHandoffItem[];
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

function HandoffField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-700">{children}</dd>
    </div>
  );
}

export default function PayrollIssueHandoffPanel({
  issues = [],
  isLoading = false,
  error,
  onRetry,
}: PayrollIssueHandoffPanelProps) {
  const validIssues = filterValidPayrollIssueHandoffs(issues);

  return (
    <section
      aria-labelledby="payroll-issue-handoff-heading"
      aria-busy={isLoading}
      className="space-y-5"
    >
      <div>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          <h1 id="payroll-issue-handoff-heading" className="text-lg font-semibold text-gray-900">
            Payroll issue handoff
          </h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Share the next safe step without exposing payroll values or employee details.
        </p>
      </div>

      {isLoading ? (
        <div role="status" className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading payroll issue handoffs...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Unable to load handoff details.</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      ) : validIssues.length === 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-green-900">No unresolved payroll issues</h2>
              <p className="mt-1 text-sm text-green-800">There is nothing waiting for handoff right now.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600" role="status">
            {validIssues.length} issue{validIssues.length === 1 ? "" : "s"} requiring coordination
          </p>
          {validIssues.map((issue) => (
            <article key={issue.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{issue.title}</h2>
                    <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{issue.status}</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                  Unresolved
                </span>
              </div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <HandoffField label="Unresolved blocker">{issue.blocker}</HandoffField>
                <HandoffField label="Owner">
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    {issue.owner?.trim() || "Unassigned"}
                  </span>
                </HandoffField>
                <HandoffField label="Next actionable item">{issue.nextAction}</HandoffField>
                <HandoffField label="Team coordination notes">
                  {issue.coordinationNotes?.trim() || "No coordination notes yet."}
                </HandoffField>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}