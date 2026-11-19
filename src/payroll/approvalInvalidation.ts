import {
  evaluateApprovalExpiry,
  type ApprovalExpiryInput,
  type ApprovalExpiryState,
} from "@/lib/date/approvalExpiry";
import {
  computeBatchDiff,
  summarizeBatchDiff,
  type BatchDiffSummary,
  type BatchRow,
} from "@/lib/payroll/batchDiff";

export type ApprovalInvalidationReason =
  | "approval_missing"
  | "approval_expired"
  | "approval_invalid"
  | "stale_revision"
  | "approval_snapshot_missing"
  | "diff_invalid"
  | "commitment_changed"
  | "recipient_removed";

export interface ApprovalInvalidationInput extends ApprovalExpiryInput {
  currentRows?: readonly BatchRow[] | null;
  approvedRows?: readonly BatchRow[] | null;
  currentRevisionNumber?: number;
  approvedRevisionNumber?: number;
  expectedRevisionNumber?: number;
  isDiffValid?: boolean;
  invalidReason?: string | null;
}

export interface ApprovalInvalidationEvaluation {
  invalid: boolean;
  isInvalid: boolean;
  isBlocked: boolean;
  blocksExecution: boolean;
  requiresReapproval: boolean;
  reason: ApprovalInvalidationReason | null;
  approvalState: ApprovalExpiryState;
  label: string;
  message: string;
  nextStep: string;
  blockedRowCount: number;
  rowSummary: BatchDiffSummary;
}

export interface ApprovalInvalidationAuditSummary {
  invalid: boolean;
  reason: ApprovalInvalidationReason | null;
  approvalState: ApprovalExpiryState;
  blockedRowCount: number;
  additions: number;
  removals: number;
  edits: number;
}

const RECOVERY_MESSAGE =
  "Review the safe batch diff, resolve the blocked rows, then obtain a fresh approval before execution.";

function emptySummary(): BatchDiffSummary {
  return summarizeBatchDiff([]);
}

function buildEvaluation(
  invalid: boolean,
  reason: ApprovalInvalidationReason | null,
  approvalState: ApprovalExpiryState,
  label: string,
  message: string,
  nextStep: string,
  rowSummary: BatchDiffSummary,
  blockedRowCount: number,
): ApprovalInvalidationEvaluation {
  return {
    invalid,
    isInvalid: invalid,
    isBlocked: invalid,
    blocksExecution: invalid,
    requiresReapproval: invalid,
    reason,
    approvalState,
    label,
    message,
    nextStep,
    blockedRowCount,
    rowSummary,
  };
}

export function evaluateApprovalInvalidation(
  input: ApprovalInvalidationInput,
  now: number = Date.now(),
): ApprovalInvalidationEvaluation {
  const expiry = evaluateApprovalExpiry(input, now);

  if (
    expiry.state === "missing" ||
    expiry.state === "expired" ||
    expiry.state === "invalid"
  ) {
    const reason: ApprovalInvalidationReason =
      expiry.state === "missing"
        ? "approval_missing"
        : expiry.state === "expired"
          ? "approval_expired"
          : "approval_invalid";

    return buildEvaluation(
      true,
      reason,
      expiry.state,
      expiry.label,
      expiry.message,
      "Open the approvals queue and obtain a fresh approval before execution.",
      emptySummary(),
      0,
    );
  }

  const {
    currentRevisionNumber,
    approvedRevisionNumber,
    expectedRevisionNumber,
  } = input;

  if (
    (typeof currentRevisionNumber === "number" &&
      typeof approvedRevisionNumber === "number" &&
      currentRevisionNumber !== approvedRevisionNumber) ||
    (typeof currentRevisionNumber === "number" &&
      typeof expectedRevisionNumber === "number" &&
      currentRevisionNumber !== expectedRevisionNumber)
  ) {
    return buildEvaluation(
      true,
      "stale_revision",
      expiry.state,
      "Approval is stale",
      "The current draft revision is different from the revision that was approved.",
      "Reopen the draft comparison, review the safe diff, and request a new approval.",
      emptySummary(),
      0,
    );
  }

  if (input.approvedRows === null || input.approvedRows === undefined) {
    return buildEvaluation(
      true,
      "approval_snapshot_missing",
      expiry.state,
      "Approved batch unavailable",
      "The approved batch snapshot could not be loaded, so the prior approval cannot be verified.",
      "Reopen the draft comparison and obtain a fresh approval before execution.",
      emptySummary(),
      0,
    );
  }

  if (input.isDiffValid === false) {
    return buildEvaluation(
      true,
      "diff_invalid",
      expiry.state,
      "Batch diff is invalid",
      "The current draft could not be compared with the approved batch.",
      "Regenerate the batch comparison and resolve the validation error before approval.",
      emptySummary(),
      0,
    );
  }

  const currentRows = [...(input.currentRows ?? [])];
  const approvedRows = [...input.approvedRows];
  const entries = computeBatchDiff(currentRows, approvedRows);
  const rowSummary = summarizeBatchDiff(entries);

  if (rowSummary.blocked > 0) {
    const hasRemoval = entries.some(
      (entry) => entry.isBlocked && entry.changeType === "removed",
    );
    const reason: ApprovalInvalidationReason = hasRemoval
      ? "recipient_removed"
      : "commitment_changed";

    return buildEvaluation(
      true,
      reason,
      expiry.state,
      hasRemoval
        ? "Approval invalid: recipient removed"
        : "Approval invalid: commitment changed",
      `${rowSummary.blocked} row(s) changed after approval and must be re-approved.`,
      RECOVERY_MESSAGE,
      rowSummary,
      rowSummary.blocked,
    );
  }

  return buildEvaluation(
    false,
    null,
    expiry.state,
    "Approval still valid",
    "The current draft matches the approved batch and remains valid for execution.",
    "Continue with execution.",
    rowSummary,
    0,
  );
}

export function isApprovalInvalid(
  input: ApprovalInvalidationInput,
  now: number = Date.now(),
): boolean {
  return evaluateApprovalInvalidation(input, now).invalid;
}

export class ApprovalInvalidationError extends Error {
  readonly code: ApprovalInvalidationReason;
  readonly nextStep: string;
  readonly evaluation: ApprovalInvalidationEvaluation;

  constructor(evaluation: ApprovalInvalidationEvaluation) {
    super(evaluation.message);
    this.name = "ApprovalInvalidationError";
    this.code = evaluation.reason ?? "approval_invalid";
    this.nextStep = evaluation.nextStep;
    this.evaluation = evaluation;
    Object.setPrototypeOf(this, ApprovalInvalidationError.prototype);
  }
}

export function assertApprovalStillValid(
  input: ApprovalInvalidationInput,
  now: number = Date.now(),
): ApprovalInvalidationEvaluation {
  const evaluation = evaluateApprovalInvalidation(input, now);
  if (evaluation.invalid) {
    throw new ApprovalInvalidationError(evaluation);
  }
  return evaluation;
}

export function summarizeApprovalInvalidationForAudit(
  evaluation: ApprovalInvalidationEvaluation,
): ApprovalInvalidationAuditSummary {
  return {
    invalid: evaluation.invalid,
    reason: evaluation.reason,
    approvalState: evaluation.approvalState,
    blockedRowCount: evaluation.blockedRowCount,
    additions: evaluation.rowSummary.additions,
    removals: evaluation.rowSummary.removals,
    edits: evaluation.rowSummary.edits,
  };
}
