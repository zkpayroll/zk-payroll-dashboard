/**
 * Payout retry approval boundaries (#695).
 *
 * Governs whether a failed payout retry is permitted to proceed without
 * additional approval, or whether it must be re-approved before the next
 * attempt. Boundaries are enforced in the dashboard layer so operators
 * are blocked before an unsafe retry reaches the contract.
 *
 * Rules:
 * 1. A retry that exceeds the configured maximum attempt count is always
 *    blocked — exhausted retries require explicit operator re-queue.
 * 2. After a configurable "approval-required threshold" number of retries,
 *    each subsequent attempt requires a fresh approval even if the prior
 *    run was already approved.
 * 3. An expired approval (past its TTL) must be re-issued regardless of
 *    the attempt count.
 *
 * Privacy: only counts, booleans, and timestamps are inspected. No salary,
 * wallet address, or employee identity is read or surfaced.
 */

export interface RetryApprovalPolicy {
  /** Hard cap on retry attempts; a count >= this value is blocked. */
  maxRetryCount: number;
  /**
   * After this many retries a fresh approval is required for every subsequent
   * attempt. Set to maxRetryCount to disable the re-approval requirement.
   */
  reApprovalThreshold: number;
  /** Approval TTL in seconds; 0 means approvals never expire. */
  approvalTtlSeconds: number;
}

export interface RetryApprovalContext {
  retryCount: number;
  hasCurrentApproval: boolean;
  /** Unix timestamp (seconds) when the current approval was granted; null if none. */
  approvalGrantedAt: number | null;
  /** Current ledger/wall-clock timestamp in seconds. */
  now: number;
}

export type RetryApprovalRejectionReason =
  | "retries_exhausted"
  | "approval_required"
  | "approval_expired";

export interface RetryApprovalDecision {
  allowed: boolean;
  requiresApproval: boolean;
  rejectionReason?: RetryApprovalRejectionReason;
  message: string;
  remainingAttempts: number;
}

export const DEFAULT_RETRY_APPROVAL_POLICY: RetryApprovalPolicy = {
  maxRetryCount: 3,
  reApprovalThreshold: 2,
  approvalTtlSeconds: 3600,
};

function isApprovalExpired(
  policy: RetryApprovalPolicy,
  context: RetryApprovalContext,
): boolean {
  if (policy.approvalTtlSeconds === 0) return false;
  if (context.approvalGrantedAt === null) return false;
  return context.now > context.approvalGrantedAt + policy.approvalTtlSeconds;
}

export function evaluateRetryApprovalBoundaries(
  policy: RetryApprovalPolicy,
  context: RetryApprovalContext,
): RetryApprovalDecision {
  const remainingAttempts = Math.max(0, policy.maxRetryCount - context.retryCount);

  if (context.retryCount >= policy.maxRetryCount) {
    return {
      allowed: false,
      requiresApproval: false,
      rejectionReason: "retries_exhausted",
      message: `This payout has used all ${policy.maxRetryCount} permitted retry attempts. An operator must re-queue it before another attempt can proceed.`,
      remainingAttempts: 0,
    };
  }

  const needsApproval = context.retryCount >= policy.reApprovalThreshold;

  if (needsApproval && !context.hasCurrentApproval) {
    return {
      allowed: false,
      requiresApproval: true,
      rejectionReason: "approval_required",
      message: `Retry attempt ${context.retryCount + 1} requires a fresh approval (re-approval required after ${policy.reApprovalThreshold} attempts). Request approval before retrying.`,
      remainingAttempts,
    };
  }

  if (context.hasCurrentApproval && isApprovalExpired(policy, context)) {
    return {
      allowed: false,
      requiresApproval: true,
      rejectionReason: "approval_expired",
      message: `The current approval expired ${Math.floor(policy.approvalTtlSeconds / 60)} minutes after it was granted. Request a new approval before retrying.`,
      remainingAttempts,
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    message: `Retry permitted — ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
    remainingAttempts,
  };
}

export class RetryApprovalBoundaryError extends Error {
  decision: RetryApprovalDecision;

  constructor(decision: RetryApprovalDecision) {
    super(decision.message);
    this.name = "RetryApprovalBoundaryError";
    this.decision = decision;
  }
}

export function assertRetryApproved(
  policy: RetryApprovalPolicy,
  context: RetryApprovalContext,
): void {
  const decision = evaluateRetryApprovalBoundaries(policy, context);
  if (!decision.allowed) {
    throw new RetryApprovalBoundaryError(decision);
  }
}
