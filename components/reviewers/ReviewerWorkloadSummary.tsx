"use client";

import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useApprovalQueueStore, type ApprovalDraft } from "@/stores/approvalQueue";

export interface ReviewerWorkloadSummaryProps {
  drafts?: ApprovalDraft[];
  isLoading?: boolean;
  error?: string | null;
  overdueAfterHours?: number;
}

interface ReviewerWorkload {
  name: string;
  pending: number;
  overdue: number;
  completed: number;
}

function buildWorkload(drafts: ApprovalDraft[], overdueAfterHours: number): ReviewerWorkload[] {
  const normalizedOverdueAfterHours = Number.isFinite(overdueAfterHours) && overdueAfterHours >= 0
    ? overdueAfterHours
    : 48;
  const cutoff = Date.now() - normalizedOverdueAfterHours * 60 * 60 * 1000;
  const workload = new Map<string, ReviewerWorkload>();

  for (const draft of drafts) {
    const reviewer = draft.reviewerName || "Executive reviewer";
    const current = workload.get(reviewer) ?? {
      name: reviewer,
      pending: 0,
      overdue: 0,
      completed: 0,
    };

    if (draft.approvalStatus === "pending_executive_approval") {
      current.pending += 1;
      const createdAt = new Date(draft.createdAt).getTime();
      if (Number.isFinite(createdAt) && createdAt < cutoff) current.overdue += 1;
    }
    if (draft.approvalStatus === "approved") current.completed += 1;
    workload.set(reviewer, current);
  }

  return Array.from(workload.values()).sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
}

export default function ReviewerWorkloadSummary({
  drafts: providedDrafts,
  isLoading = false,
  error = null,
  overdueAfterHours = 48,
}: ReviewerWorkloadSummaryProps) {
  const storeDrafts = useApprovalQueueStore((state) => state.drafts);
  const drafts = providedDrafts ?? storeDrafts;

  if (isLoading) {
    return (
      <section aria-labelledby="reviewer-workload-heading" className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
          <h2 id="reviewer-workload-heading" className="text-sm font-semibold text-gray-900">Reviewer workload</h2>
          <span className="sr-only">Loading reviewer workload</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-labelledby="reviewer-workload-heading" className="bg-white rounded-lg shadow-sm p-6">
        <h2 id="reviewer-workload-heading" className="text-sm font-semibold text-gray-900">Reviewer workload</h2>
        <p role="alert" className="mt-3 text-sm text-red-700">Unable to load reviewer workload. {error}</p>
      </section>
    );
  }

  const workload = buildWorkload(drafts, overdueAfterHours);
  const hasActivity = workload.some((reviewer) => reviewer.pending || reviewer.completed);

  return (
    <section aria-labelledby="reviewer-workload-heading" className="bg-white rounded-lg shadow-sm p-6 space-y-4">
      <div>
        <h2 id="reviewer-workload-heading" className="text-sm font-semibold text-gray-900">Reviewer workload</h2>
        <p className="text-xs text-gray-500 mt-1">Approval activity without payroll amounts or employee details.</p>
      </div>

      {!hasActivity ? (
        <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No reviewer actions are waiting for attention.
        </p>
      ) : (
        <div className="space-y-3" role="list" aria-label="Reviewer workload metrics">
          {workload.map((reviewer) => (
            <div key={reviewer.name} role="listitem" data-testid={`reviewer-workload-${reviewer.name}`} className="rounded-md border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-gray-900">{reviewer.name}</h3>
                {reviewer.overdue > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {reviewer.overdue} overdue
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <span className="flex items-center gap-1 text-gray-600"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{reviewer.pending} pending</span>
                <span className="flex items-center gap-1 text-amber-700"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{reviewer.overdue} overdue</span>
                <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{reviewer.completed} completed</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}