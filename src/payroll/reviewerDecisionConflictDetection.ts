/**
 * Reviewer decision conflict detection (#730).
 *
 * Detects and manages conflicts in reviewer decisions when multiple
 * reviewers provide contradictory approvals or rejections for payroll
 * operations. Ensures decision consistency and provides resolution paths
 * for conflicting reviewer guidance.
 *
 * Privacy guarantees: Raw employee identities and salary data are never logged
 * or exposed. Decision context is masked in user-facing status messages.
 */

export type ConflictStatus = "no_conflict" | "pending_review" | "conflict_detected" | "resolved" | "escalated";

export type ConflictResolutionMethod = "consensus_review" | "senior_operator_override" | "policy_revert";

export interface ReviewerDecision {
  id: string;
  reviewerId: string;
  operationRef: string;
  decision: "approve" | "reject";
  decisionAt: number;
  notes?: string;
}

export interface DecisionConflictPolicy {
  maxReviewersAllowed: number;
  requireConsensus: boolean;
  escalationTtlSeconds: number;
  allowOperatorOverride: boolean;
}

export const DEFAULT_CONFLICT_POLICY: DecisionConflictPolicy = {
  maxReviewersAllowed: 3,
  requireConsensus: true,
  escalationTtlSeconds: 3600, // 1 hour
  allowOperatorOverride: true,
};

export interface ConflictRecord {
  id: string;
  operationRef: string;
  decisions: ReviewerDecision[];
  status: ConflictStatus;
  detectedAt: number;
  conflictType?: "approve_reject_mismatch" | "multiple_rejections" | "timing_conflict";
  resolutionMethod?: ConflictResolutionMethod;
  resolutionApprovedBy?: string;
  resolvedAt?: number;
}

export interface CreateConflictRecordInput {
  id: string;
  operationRef: string;
  decisions: ReviewerDecision[];
  now?: number;
  policy?: Partial<DecisionConflictPolicy>;
}

export interface ConflictEvaluation {
  hasConflict: boolean;
  status: ConflictStatus;
  message: string;
  approveCount: number;
  rejectCount: number;
  resolutionRequired: boolean;
  suggestedResolution?: ConflictResolutionMethod;
}

/**
 * Detects conflicts among reviewer decisions.
 */
function detectConflictType(decisions: ReviewerDecision[]): "approve_reject_mismatch" | "multiple_rejections" | "timing_conflict" | undefined {
  if (decisions.length < 2) return undefined;

  const approvals = decisions.filter((d) => d.decision === "approve").length;
  const rejections = decisions.filter((d) => d.decision === "reject").length;

  if (approvals > 0 && rejections > 0) {
    return "approve_reject_mismatch";
  }

  if (rejections >= 2) {
    return "multiple_rejections";
  }

  const timeDiffs = [];
  for (let i = 1; i < decisions.length; i++) {
    timeDiffs.push(Math.abs(decisions[i].decisionAt - decisions[i - 1].decisionAt));
  }
  const hasTimingIssue = timeDiffs.some((diff) => diff < 60000); // Less than 60 seconds apart

  if (hasTimingIssue && approvals > 0 && rejections > 0) {
    return "timing_conflict";
  }

  return undefined;
}

/**
 * Creates a new conflict record.
 */
export function createConflictRecord(input: CreateConflictRecordInput): ConflictRecord {
  if (!input.id || input.id.trim().length === 0) {
    throw new Error("Conflict record id must be provided");
  }
  if (!input.operationRef || input.operationRef.trim().length === 0) {
    throw new Error("Operation reference must be provided");
  }
  if (!Array.isArray(input.decisions) || input.decisions.length === 0) {
    throw new Error("At least one reviewer decision must be provided");
  }

  const policy = { ...DEFAULT_CONFLICT_POLICY, ...input.policy };

  if (input.decisions.length > policy.maxReviewersAllowed) {
    throw new Error(`Too many reviewers: max ${policy.maxReviewersAllowed} allowed`);
  }

  const conflictType = detectConflictType(input.decisions);
  const hasConflict = conflictType !== undefined;

  return {
    id: input.id.trim(),
    operationRef: input.operationRef.trim(),
    decisions: input.decisions,
    status: hasConflict ? "conflict_detected" : "no_conflict",
    detectedAt: input.now ?? Date.now(),
    conflictType,
  };
}

/**
 * Resolves a conflict using the specified method.
 */
export function resolveConflict(
  conflict: ConflictRecord,
  method: ConflictResolutionMethod,
  approvedBy: string,
  now = Date.now(),
): ConflictRecord {
  if (conflict.status === "resolved") {
    throw new Error("Conflict already resolved");
  }

  if (!approvedBy || approvedBy.trim().length === 0) {
    throw new Error("Approver id must be provided");
  }

  return {
    ...conflict,
    status: "resolved",
    resolutionMethod: method,
    resolutionApprovedBy: approvedBy,
    resolvedAt: now,
  };
}

/**
 * Escalates a conflict for senior review.
 */
export function escalateConflict(
  conflict: ConflictRecord,
  reason: string,
  now = Date.now(),
): ConflictRecord {
  if (!reason || reason.trim().length === 0) {
    throw new Error("Escalation reason must be provided");
  }

  return {
    ...conflict,
    status: "escalated",
    resolvedAt: now,
  };
}

/**
 * Evaluates a conflict record.
 */
export function evaluateConflict(
  conflict: ConflictRecord,
  policy: DecisionConflictPolicy = DEFAULT_CONFLICT_POLICY,
): ConflictEvaluation {
  const approveCount = conflict.decisions.filter((d) => d.decision === "approve").length;
  const rejectCount = conflict.decisions.filter((d) => d.decision === "reject").length;

  let suggestedResolution: ConflictResolutionMethod | undefined;
  if (conflict.status === "conflict_detected") {
    if (rejectCount > approveCount) {
      suggestedResolution = "senior_operator_override";
    } else if (approveCount > rejectCount && policy.allowOperatorOverride) {
      suggestedResolution = "consensus_review";
    }
  }

  let message = "";
  switch (conflict.status) {
    case "no_conflict":
      message = `All ${conflict.decisions.length} reviewers agreed on the decision.`;
      break;
    case "pending_review":
      message = "Pending reviewer consensus resolution.";
      break;
    case "conflict_detected":
      message = `Decision conflict detected: ${approveCount} approval(s), ${rejectCount} rejection(s).`;
      break;
    case "resolved":
      message = `Conflict resolved via ${conflict.resolutionMethod}.`;
      break;
    case "escalated":
      message = "Conflict escalated for senior operator review.";
      break;
  }

  return {
    hasConflict: conflict.status === "conflict_detected",
    status: conflict.status,
    message,
    approveCount,
    rejectCount,
    resolutionRequired: conflict.status === "conflict_detected" || conflict.status === "pending_review",
    suggestedResolution,
  };
}
