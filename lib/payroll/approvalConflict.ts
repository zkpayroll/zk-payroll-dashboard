// Concurrent approval conflict detection (#552).
//
// Every mutation in stores/approvalQueue.ts (approveDraft, rejectDraft,
// requestCorrection, resubmitDraft) is an unguarded `drafts.map(...)`: it
// matches on id and overwrites `approvalStatus` regardless of what the row
// currently says. With two executives holding the same queue open, the second
// decision silently wins and the first is lost — an approve followed by a
// stale reject flips the run from `approved` to `rejected`/`cancelled` with
// no indication that an approval had already been granted, and a duplicate
// approve appends a second "approved" row to the audit history.
//
// So: a decision is only legal against the state the reviewer was actually
// looking at. This module is the pure gate; the store consults it before
// mutating and the queue renders the message it returns.
//
// PRIVACY: a conflict message is shown to a signed-in executive, but it must
// not become a side channel for payroll data. Nothing here reads or echoes
// `totalAmount`, `employeeCount`, `employeeIds` or the draft `notes` — only
// the approval state, the action, and the identity of whoever already acted.

export type ApprovalAction = "approved" | "rejected" | "correction_requested" | "resubmitted";

/** The subset of an approval draft this module is allowed to read. */
export interface ApprovalSnapshot {
  approvalStatus:
    | "pending_executive_approval"
    | "approved"
    | "rejected"
    | "correction_requested";
  approvalHistory?: Array<{
    approvedBy: string;
    approvedAt: string;
    role?: string;
    action?: ApprovalAction;
  }>;
}

/**
 * Quorum requirement for a single draft (#664).
 *
 * `requiredApprovalsCount` is the org-wide policy baseline
 * (`stores/payrollPolicy.ts`). A draft whose `totalAmount` meets or exceeds
 * `dualApprovalThreshold` needs at least 2 approvals regardless of the
 * baseline, when `requireDualApproval` is on — the two rules combine via
 * `Math.max`, they don't override each other.
 */
export interface ApprovalQuorum {
  requiredApprovalsCount: number;
  requireDualApproval: boolean;
  dualApprovalThreshold: number;
  totalAmount: number;
}

/** The number of *distinct* reviewers who have recorded an "approved" decision. */
export function approvalsRecorded(snapshot: ApprovalSnapshot): string[] {
  const approvers = new Set<string>();
  for (const entry of snapshot.approvalHistory ?? []) {
    if (entry.action === "approved") approvers.add(entry.approvedBy);
  }
  return Array.from(approvers);
}

/** How many distinct approvals a draft needs before it can move to "approved". */
export function requiredApprovalsFor(quorum: ApprovalQuorum): number {
  const baseline = Math.max(1, Math.floor(quorum.requiredApprovalsCount) || 1);
  if (quorum.requireDualApproval && quorum.totalAmount >= quorum.dualApprovalThreshold) {
    return Math.max(baseline, 2);
  }
  return baseline;
}

export interface ApprovalConflictDetail {
  /** Stable machine-readable cause, for tests and telemetry. */
  reason:
    | "not_found"
    | "already_approved"
    | "already_rejected"
    | "awaiting_correction"
    | "correction_expired"
    | "already_decided_by_you"
    | "not_awaiting_approval"
    | "insufficient_treasury_reservation"
    | "missing_decision_reason";
  /** The state the draft is actually in. */
  currentStatus: ApprovalSnapshot["approvalStatus"];
  /** Human label for the state, e.g. "Approved". */
  currentStatusLabel: string;
  /** Who got there first, when it is a different reviewer. */
  conflictingReviewer?: string;
  conflictingRole?: string;
  decidedAt?: string;
  /** The action the reviewer was attempting. */
  attemptedAction: ApprovalAction;
  /** Actionable, payroll-value-free text for the UI. */
  message: string;
}

export type ApprovalActionResult =
  | { ok: true }
  | { ok: false; conflict: ApprovalConflictDetail };

const STATUS_LABELS: Record<ApprovalSnapshot["approvalStatus"], string> = {
  pending_executive_approval: "Pending executive approval",
  approved: "Approved",
  rejected: "Rejected",
  correction_requested: "Correction requested",
};

const ACTION_LABELS: Record<ApprovalAction, string> = {
  approved: "approve",
  rejected: "reject",
  correction_requested: "request a correction on",
  resubmitted: "resubmit",
};

const PAST_TENSE: Record<ApprovalAction, string> = {
  approved: "approved",
  rejected: "rejected",
  correction_requested: "requested a correction on",
  resubmitted: "resubmitted",
};

/** The last history entry that represents a decision, newest last. */
function lastDecision(snapshot: ApprovalSnapshot) {
  if (!snapshot.approvalHistory?.length) return undefined;
  for (let i = snapshot.approvalHistory.length - 1; i >= 0; i -= 1) {
    const entry = snapshot.approvalHistory[i];
    if (entry?.action && entry.action !== "resubmitted") return entry;
  }
  return undefined;
}

/**
 * Builds the conflict payload, keeping the message free of payroll values.
 *
 * The reviewer's name is included because an executive needs to know *who* to
 * talk to; their role is included because it is the least sensitive way to
 * disambiguate two people with the same display name. Neither is a salary,
 * address or employee detail.
 */
function conflict(
  reason: ApprovalConflictDetail["reason"],
  snapshot: ApprovalSnapshot,
  attemptedAction: ApprovalAction,
  prior?: { approvedBy: string; approvedAt: string; role?: string },
): ApprovalActionResult {
  const attempted = ACTION_LABELS[attemptedAction];
  let message: string;

  switch (reason) {
    case "not_found":
      message =
        "This payroll is no longer in the approval queue. It may have been archived, or already processed — reload the queue and try again.";
      break;
    case "already_approved":
      message = prior
        ? `This payroll was already approved by ${prior.approvedBy}${prior.role ? ` (${prior.role})` : ""}. Approving it again will not create a second payout.`
        : "This payroll has already been approved. Approving it again will not create a second payout.";
      break;
    case "already_rejected":
      message = prior
        ? `This payroll was already rejected by ${prior.approvedBy}${prior.role ? ` (${prior.role})` : ""}. It needs to be corrected and resubmitted before it can be approved.`
        : "This payroll has already been rejected. It needs to be corrected and resubmitted before it can be approved.";
      break;
    case "awaiting_correction":
      message = prior
        ? `${prior.approvedBy}${prior.role ? ` (${prior.role})` : ""} has already requested a correction on this payroll. Wait for it to be resubmitted before deciding.`
        : "A correction has already been requested on this payroll. Wait for it to be resubmitted before deciding.";
      break;
    case "correction_expired":
      message = "The correction request has expired. Ask an executive to review the payroll and issue a new correction request.";
      break;
    case "already_decided_by_you":
      message = `You already recorded a decision on this payroll in this session. Reload the queue to see the current state.`;
      break;
    case "not_awaiting_approval":
    default:
      message = `This payroll is ${STATUS_LABELS[snapshot.approvalStatus].toLowerCase()}, so it cannot be ${attempted} again. Reload the queue to see the current state.`;
      break;
  }

  return {
    ok: false,
    conflict: {
      reason,
      currentStatus: snapshot.approvalStatus,
      currentStatusLabel: STATUS_LABELS[snapshot.approvalStatus],
      conflictingReviewer: prior?.approvedBy,
      conflictingRole: prior?.role,
      decidedAt: prior?.approvedAt,
      attemptedAction,
      message,
    },
  };
}

/**
 * Decides whether `attemptedAction` is legal against `snapshot`, and by whom.
 *
 * @param snapshot Current state of the draft as the reviewer sees it.
 * @param attemptedAction The action being attempted.
 * @param reviewerName The acting reviewer, used only to catch a reviewer
 *   re-submitting their own decision.
 * @param draftExists False when the id is no longer in the queue.
 */
export function evaluateApprovalAction(
  snapshot: ApprovalSnapshot | null | undefined,
  attemptedAction: ApprovalAction,
  reviewerName?: string,
  draftExists = true,
): ApprovalActionResult {
  if (!draftExists || !snapshot) {
    return conflict("not_found", { approvalStatus: "pending_executive_approval" }, attemptedAction);
  }

  const prior = lastDecision(snapshot);

  switch (snapshot.approvalStatus) {
    case "approved":
      return conflict("already_approved", snapshot, attemptedAction, prior);
    case "rejected":
      return conflict("already_rejected", snapshot, attemptedAction, prior);
    case "correction_requested":
      // Resubmit is the one action that legitimately follows this state.
      if (attemptedAction === "resubmitted") {
        return prior && reviewerName && prior.approvedBy === reviewerName
          ? conflict("already_decided_by_you", snapshot, attemptedAction, prior)
          : { ok: true };
      }
      return conflict("awaiting_correction", snapshot, attemptedAction, prior);
    case "pending_executive_approval":
    default:
      // An "approved" decision is special under quorum (#664): several
      // *distinct* reviewers each legitimately approve the same draft while
      // it stays "pending_executive_approval" until quorum is met, so the
      // last-decision-by-you guard only blocks the exact same reviewer
      // approving twice, not a second reviewer approving after the first.
      if (attemptedAction === "approved") {
        const alreadyApprovedByReviewer =
          reviewerName !== undefined &&
          approvalsRecorded(snapshot).includes(reviewerName);
        if (alreadyApprovedByReviewer) {
          return conflict("already_decided_by_you", snapshot, attemptedAction, prior);
        }
        return { ok: true };
      }
      if (prior && reviewerName && prior.approvedBy === reviewerName) {
        return conflict("already_decided_by_you", snapshot, attemptedAction, prior);
      }
      return { ok: true };
  }
}

/**
 * Builds the conflict payload for a reservation refused by treasury
 * insufficiency (#666) — distinct from the approval-state race conditions
 * `conflict()` handles, since this is a treasury-balance decision, not a
 * question of who else already decided on this draft.
 */
export function insufficientTreasuryConflict(
  snapshot: ApprovalSnapshot,
  message: string,
): ApprovalActionResult {
  return {
    ok: false,
    conflict: {
      reason: "insufficient_treasury_reservation",
      currentStatus: snapshot.approvalStatus,
      currentStatusLabel: STATUS_LABELS[snapshot.approvalStatus],
      attemptedAction: "approved",
      message,
    },
  };
}

/**
 * Review decision completeness (#684).
 *
 * `rejectDraft` and `requestCorrection` both record a reviewer's `comment`
 * into `approvalHistory`, but neither the store nor this module previously
 * verified it was non-empty — a rejection or correction request could be
 * recorded with no rationale at all. That leaves the drafter (and the audit
 * trail) with a decision but no explanation of what to fix or why the run
 * was turned back, which defeats the point of recording a reason in the
 * first place.
 *
 * `approved` deliberately stays exempt: approving carries no obligation to
 * justify "why this is fine", and the queue UI already supplies a sensible
 * default comment for it. Only decisions that ask someone to act on
 * feedback (`rejected`, `correction_requested`) must actually carry that
 * feedback.
 */
export function requiresDecisionReason(action: ApprovalAction): boolean {
  return action === "rejected" || action === "correction_requested";
}

/** Whether `comment` is non-empty after trimming — whitespace-only doesn't count. */
export function hasDecisionReason(comment?: string): boolean {
  return typeof comment === "string" && comment.trim().length > 0;
}

/**
 * Builds the conflict payload for a rejection/correction attempted without a
 * reason. Kept separate from `conflict()` (approval-state races) since this
 * is a completeness check on the *input*, not a question of the draft's
 * current state — it can fire even against a draft nobody else has touched.
 */
export function missingDecisionReasonConflict(
  snapshot: ApprovalSnapshot,
  attemptedAction: ApprovalAction,
): ApprovalActionResult {
  const attempted = ACTION_LABELS[attemptedAction];
  return {
    ok: false,
    conflict: {
      reason: "missing_decision_reason",
      currentStatus: snapshot.approvalStatus,
      currentStatusLabel: STATUS_LABELS[snapshot.approvalStatus],
      attemptedAction,
      message: `A reason is required to ${attempted} this payroll. Add a comment explaining what needs to change before submitting the decision.`,
    },
  };
}

/** Exposed for the queue UI, which labels the state in a conflict banner. */
export function approvalStatusLabel(status: ApprovalSnapshot["approvalStatus"]): string {
  return STATUS_LABELS[status];
}

/** Exposed for tests and for rendering a past-tense action summary. */
export function pastTenseAction(action: ApprovalAction): string {
  return PAST_TENSE[action];
}
