"use client";

import { useMemo } from "react";
import { Ban, Clock } from "lucide-react";
import { useApprovalQueueStore } from "@/stores/approvalQueue";
import {
  getRejectedCorrectionEvents,
  MISSING_REASON_COPY,
  REJECTED_CORRECTION_NEXT_STEP,
  WITHHELD_REASON_COPY,
  type RejectedCorrectionEvent,
} from "@/lib/payroll/rejectedCorrections";

function formatAbsolute(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventRow({ event }: { event: RejectedCorrectionEvent }) {
  const rounds = `${event.correctionRounds} correction round${event.correctionRounds !== 1 ? "s" : ""}`;
  const reasonId = `rc-reason-${event.id}`;

  return (
    <li
      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
      aria-describedby={reasonId}
      data-testid="rejected-correction-event"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-2 ring-red-100"
        aria-hidden="true"
      >
        <Ban className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-gray-900">Correction rejected</span>
          <span className="font-mono text-xs text-gray-500">{event.payrollRunId}</span>
        </div>

        <p className="mt-0.5 text-xs text-gray-500">
          {rounds}
          <span className="mx-1" aria-hidden="true">·</span>
          {event.resubmittedBeforeRejection
            ? "rejected after resubmission"
            : "rejected before the drafter resubmitted"}
        </p>

        <p id={reasonId} className="mt-1 text-sm text-gray-700 break-words">
          {event.reason ? (
            <>
              <span className="sr-only">Reason: </span>
              {event.reason}
            </>
          ) : (
            <span className="italic text-gray-500">
              {event.reasonWithheld ? WITHHELD_REASON_COPY : MISSING_REASON_COPY}
            </span>
          )}
        </p>

        <p className="mt-1 text-xs text-gray-400">
          {event.rejectedBy}
          {event.rejectedByRole ? ` · ${event.rejectedByRole}` : ""}
          <span className="mx-1" aria-hidden="true">·</span>
          <time dateTime={event.rejectedAt}>{formatAbsolute(event.rejectedAt)}</time>
          <span className="mx-1" aria-hidden="true">·</span>
          corrections last requested{" "}
          <time dateTime={event.lastCorrectionRequestedAt}>
            {formatAbsolute(event.lastCorrectionRequestedAt)}
          </time>
        </p>
      </div>
    </li>
  );
}

/**
 * Payroll history panel listing executive rejections of runs that had been
 * sent back for corrections (#844).
 *
 * Privacy: reads only approval metadata via `getRejectedCorrectionEvents`;
 * amounts, headcount, employee ids and draft notes are never rendered, and
 * reviewer reasons that mention sensitive data are withheld.
 */
export function RejectedCorrectionHistory({ className = "" }: { className?: string }) {
  const drafts = useApprovalQueueStore((s) => s.drafts);
  const events = useMemo(() => getRejectedCorrectionEvents(drafts), [drafts]);

  return (
    <section aria-labelledby="rejected-corrections-heading" className={className}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-red-600" aria-hidden="true" />
          <h3 id="rejected-corrections-heading" className="text-sm font-semibold text-gray-900">
            Rejected Corrections
          </h3>
        </div>
        {events.length > 0 && (
          <span className="text-xs text-gray-400">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center">
          <Clock className="mx-auto mb-2 h-6 w-6 text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500">No rejected corrections.</p>
          <p className="mt-1 text-xs text-gray-400">
            Runs rejected after a correction request appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-3 text-xs text-gray-500">{REJECTED_CORRECTION_NEXT_STEP}</p>
          <ol aria-label="Rejected correction events" className="divide-y divide-gray-100">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export default RejectedCorrectionHistory;
