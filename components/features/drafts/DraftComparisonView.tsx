"use client";

import { BatchDiffView } from "@/components/features/batches/BatchDiffView";
import {
  compareDraftRevisions,
  type DraftComparisonRequest,
} from "@/src/payroll/draftComparisonSnapshot";

export interface DraftComparisonViewProps {
  request: DraftComparisonRequest;
}

export function DraftComparisonView({ request }: DraftComparisonViewProps) {
  const result = compareDraftRevisions(request);

  if (!result.ok) {
    return (
      <section
        role="alert"
        data-testid="draft-comparison-unavailable"
        className="rounded-lg border border-amber-300 bg-amber-50 p-4"
      >
        <h2 className="text-sm font-semibold text-amber-900">
          Draft comparison unavailable
        </h2>
        <p className="mt-1 text-sm text-amber-800">{result.error.message}</p>
        <p className="mt-1 text-xs text-amber-700">{result.error.remediation}</p>
      </section>
    );
  }

  const { snapshot } = result;
  const currentRows = [...(request.current?.rows ?? [])];
  const approvedRows = [...(request.approved?.rows ?? [])];

  return (
    <div className="space-y-4" data-testid="draft-comparison-view">
      <section
        aria-labelledby="draft-comparison-heading"
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="draft-comparison-heading" className="text-base font-semibold text-gray-900">
              Draft version comparison
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {snapshot.approvedRevisionId
                ? `Revision ${snapshot.currentRevisionId} compared with approved revision ${snapshot.approvedRevisionId}.`
                : `Revision ${snapshot.currentRevisionId} is a first approval; no prior approved version is available.`}
            </p>
          </div>
          {snapshot.requiresReapproval && (
            <span
              role="status"
              className="inline-flex w-fit rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
            >
              Re-approval required
            </span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
          <div><dt className="text-gray-500">Added</dt><dd data-testid="comparison-additions" className="font-medium text-gray-900">{snapshot.summary.additions}</dd></div>
          <div><dt className="text-gray-500">Removed</dt><dd data-testid="comparison-removals" className="font-medium text-gray-900">{snapshot.summary.removals}</dd></div>
          <div><dt className="text-gray-500">Updated</dt><dd data-testid="comparison-edits" className="font-medium text-gray-900">{snapshot.summary.edits}</dd></div>
          <div><dt className="text-gray-500">Unchanged</dt><dd className="font-medium text-gray-900">{snapshot.summary.unchanged}</dd></div>
          <div><dt className="text-gray-500">Blocked</dt><dd className="font-medium text-gray-900">{snapshot.summary.blocked}</dd></div>
        </dl>
      </section>

      <BatchDiffView
        currentRows={currentRows}
        approvedRows={approvedRows}
        title="Payroll entry changes"
      />
    </div>
  );
}

export default DraftComparisonView;