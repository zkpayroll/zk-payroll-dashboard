/**
 * Employee reinstatement payroll review module (#722).
 *
 * Implements the dashboard layer review workflow for employees returning from
 * suspension, offboarding, or inactive status before they are restored to active
 * payroll eligibility.
 *
 * Provides structured review stages, prerequisite validation gates, reviewer decision
 * handling, batch reconciliation, and privacy-safe error reporting.
 *
 * Privacy guarantees:
 * - Raw salary figures and zero-knowledge commitment secrets are never handled or logged.
 * - Wallet addresses are masked by default (e.g., `GABCD...WXYZ`).
 * - Review records and validation messages provide operational clarity without leaking PII.
 */

export type ReinstatementReviewStatus =
  | "pending_review"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

export type ReinstatementReviewStepType =
  | "roster_eligibility_check"
  | "onboarding_completion_verification"
  | "payout_destination_confirmation"
  | "compensation_policy_verification"
  | "operator_reinstatement_approval";

export interface ReinstatementReviewPolicy {
  requireOnboardingVerification: boolean;
  requireDestinationConfirmation: boolean;
  requireCompensationPolicyCheck: boolean;
  requireAdminApproval: boolean;
  reviewTtlSeconds: number;
  allowRetroactiveEffectiveDate: boolean;
  maxRetroactiveDays: number;
}

export const DEFAULT_REINSTATEMENT_POLICY: ReinstatementReviewPolicy = {
  requireOnboardingVerification: true,
  requireDestinationConfirmation: true,
  requireCompensationPolicyCheck: true,
  requireAdminApproval: true,
  reviewTtlSeconds: 604800, // 7 days
  allowRetroactiveEffectiveDate: false,
  maxRetroactiveDays: 0,
};

export interface ReinstatementReviewRecord {
  id: string;
  employeeRef: string;
  employeeName: string;
  previousStatus: "suspended" | "offboarded" | "inactive";
  reinstatementEffectiveDate: string;
  walletAddressMasked: string;
  status: ReinstatementReviewStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewerId?: string;
  completedSteps: ReinstatementReviewStepType[];
  reinstatementReason: string;
  rejectionReason?: string;
  notes?: string;
}

export interface CreateReinstatementReviewInput {
  id: string;
  employeeRef: string;
  employeeName: string;
  previousStatus: "suspended" | "offboarded" | "inactive";
  reinstatementEffectiveDate: string;
  walletAddress: string;
  reinstatementReason: string;
  now?: number;
  notes?: string;
  policy?: Partial<ReinstatementReviewPolicy>;
}

export interface ReinstatementReviewEvaluation {
  canApprove: boolean;
  canReject: boolean;
  isExpired: boolean;
  status: ReinstatementReviewStatus;
  message: string;
  completedSteps: ReinstatementReviewStepType[];
  missingSteps: ReinstatementReviewStepType[];
  validationErrors: string[];
}

export interface BatchReinstatementReviewSummary {
  totalReviews: number;
  approvedCount: number;
  pendingCount: number;
  underReviewCount: number;
  rejectedCount: number;
  expiredCount: number;
  canProceedWithPayroll: boolean;
  blockerMessage: string | null;
  reviews: ReinstatementReviewRecord[];
}

const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Mask a Stellar wallet address for privacy-safe display.
 */
export function maskAddress(address: string): string {
  if (!address || typeof address !== "string") return "G*****";
  const trimmed = address.trim();
  if (trimmed.length < 10) return `${trimmed.slice(0, 2)}...`;
  return `${trimmed.slice(0, 5)}...${trimmed.slice(-5)}`;
}

/**
 * Validates format of an ISO date string.
 */
function isValidDateString(dateStr: string): boolean {
  if (!dateStr || !ISO_DATE_REGEX.test(dateStr)) return false;
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime());
}

/**
 * Creates a new employee reinstatement payroll review record.
 */
export function createReinstatementReview(
  input: CreateReinstatementReviewInput,
): ReinstatementReviewRecord {
  if (!input.id || input.id.trim().length === 0) {
    throw new Error("Review ID must be provided.");
  }
  if (!input.employeeRef || input.employeeRef.trim().length === 0) {
    throw new Error("Employee reference must be provided.");
  }
  if (!input.employeeName || input.employeeName.trim().length === 0) {
    throw new Error("Employee name must be provided.");
  }
  if (!input.reinstatementReason || input.reinstatementReason.trim().length === 0) {
    throw new Error("Reinstatement reason must be provided.");
  }
  if (!isValidDateString(input.reinstatementEffectiveDate)) {
    throw new Error("Invalid reinstatement effective date format. Expected ISO date format.");
  }

  const effectiveTimestamp = new Date(input.reinstatementEffectiveDate).getTime();
  const now = input.now ?? Date.now();
  const policy = { ...DEFAULT_REINSTATEMENT_POLICY, ...input.policy };

  if (!policy.allowRetroactiveEffectiveDate && effectiveTimestamp < now - 86400000) {
    throw new Error("Retroactive reinstatement date is not permitted under current policy.");
  }

  const cleanWallet = (input.walletAddress || "").trim();
  if (!cleanWallet || !STELLAR_ADDRESS_REGEX.test(cleanWallet)) {
    throw new Error("A valid Stellar destination address is required for payroll reinstatement.");
  }

  return {
    id: input.id.trim(),
    employeeRef: input.employeeRef.trim(),
    employeeName: input.employeeName.trim(),
    previousStatus: input.previousStatus,
    reinstatementEffectiveDate: input.reinstatementEffectiveDate,
    walletAddressMasked: maskAddress(cleanWallet),
    status: "pending_review",
    createdAt: now,
    completedSteps: [],
    reinstatementReason: input.reinstatementReason.trim(),
    notes: input.notes?.trim(),
  };
}

/**
 * Determine required steps according to policy.
 */
export function getRequiredReviewSteps(
  policy: ReinstatementReviewPolicy = DEFAULT_REINSTATEMENT_POLICY,
): ReinstatementReviewStepType[] {
  const steps: ReinstatementReviewStepType[] = ["roster_eligibility_check"];
  if (policy.requireOnboardingVerification) {
    steps.push("onboarding_completion_verification");
  }
  if (policy.requireDestinationConfirmation) {
    steps.push("payout_destination_confirmation");
  }
  if (policy.requireCompensationPolicyCheck) {
    steps.push("compensation_policy_verification");
  }
  if (policy.requireAdminApproval) {
    steps.push("operator_reinstatement_approval");
  }
  return steps;
}

/**
 * Submits a completed verification step for a reinstatement review record.
 */
export function submitReviewStep(
  record: ReinstatementReviewRecord,
  step: ReinstatementReviewStepType,
  operatorId: string,
  now: number = Date.now(),
  policy: ReinstatementReviewPolicy = DEFAULT_REINSTATEMENT_POLICY,
): ReinstatementReviewRecord {
  if (record.status === "approved" || record.status === "rejected" || record.status === "expired") {
    throw new Error(`Cannot add review step to reinstatement review with terminal status '${record.status}'.`);
  }
  if (!operatorId || operatorId.trim().length === 0) {
    throw new Error("Operator ID must be provided to submit review step.");
  }

  // Check TTL expiration
  if (now > record.createdAt + policy.reviewTtlSeconds * 1000) {
    return {
      ...record,
      status: "expired",
      reviewedAt: now,
    };
  }

  const updatedSteps = Array.from(new Set([...record.completedSteps, step]));
  const requiredSteps = getRequiredReviewSteps(policy);
  const allCompleted = requiredSteps.every((s) => updatedSteps.includes(s));

  return {
    ...record,
    completedSteps: updatedSteps,
    status: allCompleted ? "under_review" : "under_review",
    reviewedAt: now,
    reviewerId: operatorId.trim(),
  };
}

/**
 * Approves an employee reinstatement payroll review.
 * Only administrators can approve. All required verification steps must be completed.
 */
export function approveReinstatementReview(
  record: ReinstatementReviewRecord,
  reviewerId: string,
  reviewerRole: string,
  now: number = Date.now(),
  notes?: string,
  policy: ReinstatementReviewPolicy = DEFAULT_REINSTATEMENT_POLICY,
): ReinstatementReviewRecord {
  if (reviewerRole !== "admin") {
    throw new Error("Only administrators are authorized to approve employee reinstatement.");
  }
  if (record.status === "approved") {
    throw new Error("Reinstatement review is already approved.");
  }
  if (record.status === "rejected" || record.status === "expired") {
    throw new Error(`Cannot approve reinstatement review with terminal status '${record.status}'.`);
  }
  if (!reviewerId || reviewerId.trim().length === 0) {
    throw new Error("Reviewer ID must be provided for approval.");
  }

  // Check expiration
  if (now > record.createdAt + policy.reviewTtlSeconds * 1000) {
    return {
      ...record,
      status: "expired",
      reviewedAt: now,
      reviewerId: reviewerId.trim(),
    };
  }

  const requiredSteps = getRequiredReviewSteps(policy).filter(
    (s) => s !== "operator_reinstatement_approval",
  );
  const missingSteps = requiredSteps.filter((s) => !record.completedSteps.includes(s));

  if (missingSteps.length > 0) {
    throw new Error(
      `Cannot approve reinstatement review: ${missingSteps.length} prerequisite verification step(s) remaining (${missingSteps.join(", ")}).`,
    );
  }

  const updatedSteps = Array.from(
    new Set([...record.completedSteps, "operator_reinstatement_approval" as ReinstatementReviewStepType]),
  );

  return {
    ...record,
    status: "approved",
    completedSteps: updatedSteps,
    reviewerId: reviewerId.trim(),
    reviewedAt: now,
    notes: notes ? notes.trim() : record.notes,
  };
}

/**
 * Rejects an employee reinstatement payroll review.
 */
export function rejectReinstatementReview(
  record: ReinstatementReviewRecord,
  reviewerId: string,
  rejectionReason: string,
  reviewerRole: string,
  now: number = Date.now(),
): ReinstatementReviewRecord {
  if (reviewerRole !== "admin") {
    throw new Error("Only administrators are authorized to reject employee reinstatement.");
  }
  if (record.status === "approved" || record.status === "rejected") {
    throw new Error(`Cannot reject reinstatement review with status '${record.status}'.`);
  }
  if (!rejectionReason || rejectionReason.trim().length === 0) {
    throw new Error("A clear rejection reason must be provided.");
  }
  if (!reviewerId || reviewerId.trim().length === 0) {
    throw new Error("Reviewer ID must be provided.");
  }

  return {
    ...record,
    status: "rejected",
    rejectionReason: rejectionReason.trim(),
    reviewerId: reviewerId.trim(),
    reviewedAt: now,
  };
}

/**
 * Evaluates the status and readiness of a reinstatement review record.
 */
export function evaluateReinstatementReview(
  record: ReinstatementReviewRecord,
  policy: ReinstatementReviewPolicy = DEFAULT_REINSTATEMENT_POLICY,
  now: number = Date.now(),
): ReinstatementReviewEvaluation {
  const isExpired =
    record.status === "expired" ||
    (record.status !== "approved" &&
      record.status !== "rejected" &&
      now > record.createdAt + policy.reviewTtlSeconds * 1000);

  const requiredSteps = getRequiredReviewSteps(policy);
  const missingSteps = requiredSteps.filter((s) => !record.completedSteps.includes(s));
  const validationErrors: string[] = [];

  if (isExpired) {
    validationErrors.push("Review period has expired. A new reinstatement review must be initiated.");
  }
  if (record.status === "rejected") {
    validationErrors.push(`Reinstatement was rejected: ${record.rejectionReason || "No reason provided"}.`);
  }
  if (missingSteps.length > 0 && record.status !== "approved" && record.status !== "rejected") {
    validationErrors.push(`${missingSteps.length} required review verification step(s) pending.`);
  }

  let message = "";
  switch (record.status) {
    case "pending_review":
      message = "Reinstatement review pending verification.";
      break;
    case "under_review":
      message = `Reinstatement review in progress (${record.completedSteps.length}/${requiredSteps.length} steps completed).`;
      break;
    case "approved":
      message = `Reinstatement approved for ${record.employeeName}. Cleared for payroll processing.`;
      break;
    case "rejected":
      message = `Reinstatement rejected: ${record.rejectionReason}.`;
      break;
    case "expired":
      message = "Reinstatement review expired.";
      break;
  }

  const canApprove = !isExpired && record.status !== "approved" && record.status !== "rejected";
  const canReject = !isExpired && record.status !== "approved" && record.status !== "rejected";

  return {
    canApprove,
    canReject,
    isExpired,
    status: isExpired ? "expired" : record.status,
    message,
    completedSteps: record.completedSteps,
    missingSteps,
    validationErrors,
  };
}

/**
 * Validates a batch of reinstatement reviews for payroll run eligibility.
 */
export function validateBatchReinstatementReviews(
  reviews: ReinstatementReviewRecord[],
  policy: ReinstatementReviewPolicy = DEFAULT_REINSTATEMENT_POLICY,
  now: number = Date.now(),
): BatchReinstatementReviewSummary {
  if (reviews.length === 0) {
    return {
      totalReviews: 0,
      approvedCount: 0,
      pendingCount: 0,
      underReviewCount: 0,
      rejectedCount: 0,
      expiredCount: 0,
      canProceedWithPayroll: true,
      blockerMessage: null,
      reviews: [],
    };
  }

  let approvedCount = 0;
  let pendingCount = 0;
  let underReviewCount = 0;
  let rejectedCount = 0;
  let expiredCount = 0;
  const blockedNames: string[] = [];

  for (const review of reviews) {
    const evalResult = evaluateReinstatementReview(review, policy, now);
    if (evalResult.status === "approved") {
      approvedCount++;
    } else if (evalResult.status === "expired") {
      expiredCount++;
      blockedNames.push(`${review.employeeName} (Review expired)`);
    } else if (evalResult.status === "rejected") {
      rejectedCount++;
      blockedNames.push(`${review.employeeName} (Reinstatement rejected)`);
    } else if (evalResult.status === "under_review") {
      underReviewCount++;
      blockedNames.push(`${review.employeeName} (Verification incomplete)`);
    } else {
      pendingCount++;
      blockedNames.push(`${review.employeeName} (Pending review)`);
    }
  }

  const allApproved = approvedCount === reviews.length;
  const blockerMessage = allApproved
    ? null
    : `${blockedNames.length} employee reinstatement(s) have unapproved payroll reviews: ${blockedNames.join(", ")}. Complete and approve reinstatement reviews before payroll execution.`;

  return {
    totalReviews: reviews.length,
    approvedCount,
    pendingCount,
    underReviewCount,
    rejectedCount,
    expiredCount,
    canProceedWithPayroll: allApproved,
    blockerMessage,
    reviews,
  };
}
