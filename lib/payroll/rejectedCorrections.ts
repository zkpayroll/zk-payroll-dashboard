// Rejected correction events for payroll history (#844).
//
// A "rejected correction" is an executive rejection recorded on a payroll
// draft that had already been sent back to the drafter for corrections at
// least once. These are the runs operators most often need to explain later:
// the drafter was told what to fix, (possibly) resubmitted, and the run was
// still refused — so it was cancelled instead of released.
//
// The approval queue (`stores/approvalQueue.ts`) is the source of truth: each
// draft carries an append-only `approvalHistory`. This module is a pure
// derivation over that history, so rejections recorded before this feature
// shipped show up too, with no backfill.
//
// PRIVACY: the history page is visible to more roles than the approval queue.
// Nothing here reads `totalAmount`, `employeeCount`, `employeeIds` or the
// draft `notes`. The only free text carried forward is the reviewer's
// rejection reason, and only after it passes the same sensitive-content scan
// used for run notes; a reason that mentions an amount, employee data or a
// credential is withheld entirely (never partially masked), and the event
// says so with static, actionable copy.

import { scanRunNoteForSensitiveContent } from "@/lib/privacy/runNotes";

type HistoryAction = "approved" | "rejected" | "correction_requested" | "resubmitted";

/** The subset of an approval draft this module is allowed to read. */
export interface RejectedCorrectionSource {
  id: string;
  approvalStatus?: string;
  approvalHistory?: Array<{
    approvedBy: string;
    approvedAt: string;
    role?: string;
    comment?: string;
    action?: HistoryAction;
  }>;
}

export interface RejectedCorrectionEvent {
  /** Stable id: `<payrollRunId>:rejected:<rejectedAt>`. */
  id: string;
  payrollRunId: string;
  rejectedAt: string;
  rejectedBy: string;
  rejectedByRole?: string;
  /** Timestamp of the most recent correction request before the rejection. */
  lastCorrectionRequestedAt: string;
  /** Correction requests issued before this rejection (always >= 1). */
  correctionRounds: number;
  /** Whether the drafter resubmitted after the latest correction request. */
  resubmittedBeforeRejection: boolean;
  /** Reviewer's reason, only when it passed the privacy scan. */
  reason: string | null;
  /** True when a reason was given but withheld for containing sensitive data. */
  reasonWithheld: boolean;
}

/** Shown in place of a reason that failed the privacy scan. */
export const WITHHELD_REASON_COPY =
  "Reason withheld because it referenced salary figures, employee data, or credentials. Ask the reviewer to restate it without sensitive details.";

/** Shown when the reviewer recorded no reason at all (legacy rejections). */
export const MISSING_REASON_COPY =
  "No reason was recorded. Contact the reviewer before drafting a replacement run.";

/** Next step shown on every rejected correction: rejected runs are terminal. */
export const REJECTED_CORRECTION_NEXT_STEP =
  "Rejected runs cannot be resubmitted. Create a new draft that addresses the reviewer's feedback.";

function toTime(value: string): number {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

function safeReason(comment: string | undefined): Pick<RejectedCorrectionEvent, "reason" | "reasonWithheld"> {
  const trimmed = comment?.trim() ?? "";
  if (!trimmed) return { reason: null, reasonWithheld: false };
  if (scanRunNoteForSensitiveContent(trimmed).length > 0) {
    return { reason: null, reasonWithheld: true };
  }
  return { reason: trimmed, reasonWithheld: false };
}

/**
 * Derive every rejected-correction event from a set of approval drafts.
 *
 * Rules:
 * - History entries are ordered by `approvedAt`; entries with an unparseable
 *   timestamp are ignored rather than guessed into place.
 * - A rejection counts only if at least one `correction_requested` entry
 *   precedes it on the same draft. A plain rejection of a first submission is
 *   not a correction event.
 * - Correction rounds are counted per rejection, so a draft rejected, then
 *   (hypothetically) re-entered and rejected again, reports each separately.
 *
 * Returned newest first.
 */
export function getRejectedCorrectionEvents(
  drafts: ReadonlyArray<RejectedCorrectionSource>,
): RejectedCorrectionEvent[] {
  const events: RejectedCorrectionEvent[] = [];

  for (const draft of drafts) {
    const history = (draft.approvalHistory ?? [])
      .map((entry, index) => ({ entry, index, time: toTime(entry.approvedAt) }))
      .filter((item) => !Number.isNaN(item.time))
      // Stable for identical timestamps: fall back to recorded order.
      .sort((a, b) => a.time - b.time || a.index - b.index);

    let correctionRounds = 0;
    let lastCorrectionRequestedAt: string | null = null;
    let resubmittedSinceCorrection = false;

    for (const { entry } of history) {
      if (entry.action === "correction_requested") {
        correctionRounds += 1;
        lastCorrectionRequestedAt = entry.approvedAt;
        resubmittedSinceCorrection = false;
      } else if (entry.action === "resubmitted") {
        if (lastCorrectionRequestedAt) resubmittedSinceCorrection = true;
      } else if (entry.action === "rejected") {
        if (correctionRounds > 0 && lastCorrectionRequestedAt) {
          events.push({
            id: `${draft.id}:rejected:${entry.approvedAt}`,
            payrollRunId: draft.id,
            rejectedAt: entry.approvedAt,
            rejectedBy: entry.approvedBy,
            rejectedByRole: entry.role,
            lastCorrectionRequestedAt,
            correctionRounds,
            resubmittedBeforeRejection: resubmittedSinceCorrection,
            ...safeReason(entry.comment),
          });
        }
        // A rejection closes the correction cycle.
        correctionRounds = 0;
        lastCorrectionRequestedAt = null;
        resubmittedSinceCorrection = false;
      }
    }
  }

  return events.sort((a, b) => toTime(b.rejectedAt) - toTime(a.rejectedAt));
}
