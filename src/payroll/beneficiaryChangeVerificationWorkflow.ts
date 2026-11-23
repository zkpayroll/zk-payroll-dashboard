/**
 * Beneficiary change verification workflow (#690).
 *
 * Governs multi-stage verification workflows when a contributor or employee
 * payout destination (beneficiary address/account) is updated. Protects against
 * unauthorized address switches, enforces mandatory cooling-off windows,
 * and blocks updates while an active payroll cycle is in progress.
 *
 * Privacy guarantees: Raw employee identities and salary data are never logged
 * or exposed. Addresses are masked or hashed in user-facing status messages.
 */

export type BeneficiaryChangeStatus =
  | "draft"
  | "pending_verification"
  | "cooling_off"
  | "verified_active"
  | "rejected"
  | "expired";

export type VerificationStepType =
  | "contributor_confirmation"
  | "two_factor_auth"
  | "dual_operator_signoff";

export interface BeneficiaryChangeWorkflowPolicy {
  coolingOffDurationSeconds: number;
  requireTwoFactor: boolean;
  requireDualApproval: boolean;
  requestTtlSeconds: number;
}

export const DEFAULT_BENEFICIARY_WORKFLOW_POLICY: BeneficiaryChangeWorkflowPolicy = {
  coolingOffDurationSeconds: 86400, // 24 hours
  requireTwoFactor: true,
  requireDualApproval: true,
  requestTtlSeconds: 604800, // 7 days
};

export interface BeneficiaryChangeRequest {
  id: string;
  employeeRef: string;
  currentAddressMasked: string;
  proposedAddressMasked: string;
  status: BeneficiaryChangeStatus;
  requestedBy: string;
  requestedAt: number;
  coolingOffDurationSeconds: number;
  coolingOffStartedAt?: number;
  verifiedAt?: number;
  completedSteps: VerificationStepType[];
  rejectionReason?: string;
  rejectionNote?: string;
}

export interface CreateBeneficiaryChangeInput {
  id: string;
  employeeRef: string;
  currentAddressMasked: string;
  proposedAddressMasked: string;
  requestedBy: string;
  now?: number;
  policy?: Partial<BeneficiaryChangeWorkflowPolicy>;
}

export interface WorkflowEvaluationContext {
  now: number;
  isPayrollInProgress: boolean;
}

export interface BeneficiaryChangeDecision {
  canExecute: boolean;
  status: BeneficiaryChangeStatus;
  message: string;
  missingSteps: VerificationStepType[];
  remainingCoolingOffSeconds: number;
  rejectionReason?: string;
}

export function maskAddress(address: string): string {
  if (!address || address.length < 8) return "********";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Creates a new beneficiary change request in pending_verification status.
 */
export function createBeneficiaryChangeRequest(
  input: CreateBeneficiaryChangeInput,
): BeneficiaryChangeRequest {
  if (!input.id || input.id.trim().length === 0) {
    throw new Error("Beneficiary change request id must be provided");
  }
  if (!input.employeeRef || input.employeeRef.trim().length === 0) {
    throw new Error("Employee reference must be provided");
  }
  if (!input.proposedAddressMasked || input.proposedAddressMasked.trim().length === 0) {
    throw new Error("Proposed beneficiary address must be provided");
  }

  const policy = { ...DEFAULT_BENEFICIARY_WORKFLOW_POLICY, ...input.policy };

  return {
    id: input.id.trim(),
    employeeRef: input.employeeRef.trim(),
    currentAddressMasked: input.currentAddressMasked,
    proposedAddressMasked: input.proposedAddressMasked,
    status: "pending_verification",
    requestedBy: input.requestedBy,
    requestedAt: input.now ?? Date.now(),
    coolingOffDurationSeconds: policy.coolingOffDurationSeconds,
    completedSteps: [],
  };
}

/**
 * Submits a verification step for an ongoing beneficiary change request.
 */
export function submitVerificationStep(
  request: BeneficiaryChangeRequest,
  step: VerificationStepType,
  operatorId: string,
  now = Date.now(),
  policy: BeneficiaryChangeWorkflowPolicy = DEFAULT_BENEFICIARY_WORKFLOW_POLICY,
): BeneficiaryChangeRequest {
  if (request.status !== "pending_verification") {
    throw new Error(`Cannot add verification step to request with status '${request.status}'`);
  }

  if (step === "dual_operator_signoff" && operatorId === request.requestedBy) {
    throw new Error("Dual operator sign-off must be performed by a different operator than the requester");
  }

  const updatedSteps = Array.from(new Set([...request.completedSteps, step]));

  // Check if all required steps are satisfied
  const requiredSteps: VerificationStepType[] = [];
  if (policy.requireTwoFactor) requiredSteps.push("two_factor_auth");
  if (policy.requireDualApproval) requiredSteps.push("dual_operator_signoff");
  requiredSteps.push("contributor_confirmation");

  const allCompleted = requiredSteps.every((s) => updatedSteps.includes(s));

  if (allCompleted) {
    return {
      ...request,
      completedSteps: updatedSteps,
      status: policy.coolingOffDurationSeconds > 0 ? "cooling_off" : "verified_active",
      coolingOffStartedAt: now,
      verifiedAt: policy.coolingOffDurationSeconds > 0 ? undefined : now,
    };
  }

  return {
    ...request,
    completedSteps: updatedSteps,
  };
}

/**
 * Evaluates whether a beneficiary change is ready to be executed against the active state.
 */
export function evaluateBeneficiaryChangeReadiness(
  request: BeneficiaryChangeRequest,
  context: WorkflowEvaluationContext,
  policy: BeneficiaryChangeWorkflowPolicy = DEFAULT_BENEFICIARY_WORKFLOW_POLICY,
): BeneficiaryChangeDecision {
  // Check for expiration
  if (
    request.status === "pending_verification" &&
    context.now > request.requestedAt + policy.requestTtlSeconds * 1000
  ) {
    return {
      canExecute: false,
      status: "expired",
      message: "The beneficiary change request has expired and must be re-initiated.",
      missingSteps: [],
      remainingCoolingOffSeconds: 0,
      rejectionReason: "request_expired",
    };
  }

  if (request.status === "rejected") {
    return {
      canExecute: false,
      status: "rejected",
      message: `The change request was rejected: ${request.rejectionNote || "Policy rejection"}.`,
      missingSteps: [],
      remainingCoolingOffSeconds: 0,
      rejectionReason: request.rejectionReason || "rejected",
    };
  }

  // Active payroll safety lock
  if (context.isPayrollInProgress) {
    return {
      canExecute: false,
      status: request.status,
      message: "Beneficiary changes cannot be applied while an active payroll cycle is in progress.",
      missingSteps: [],
      remainingCoolingOffSeconds: 0,
      rejectionReason: "payroll_in_progress",
    };
  }

  // Calculate missing required verification steps
  const requiredSteps: VerificationStepType[] = ["contributor_confirmation"];
  if (policy.requireTwoFactor) requiredSteps.push("two_factor_auth");
  if (policy.requireDualApproval) requiredSteps.push("dual_operator_signoff");

  const missingSteps = requiredSteps.filter((s) => !request.completedSteps.includes(s));

  if (missingSteps.length > 0) {
    return {
      canExecute: false,
      status: "pending_verification",
      message: `Verification pending: ${missingSteps.join(", ")} step(s) remaining.`,
      missingSteps,
      remainingCoolingOffSeconds: 0,
      rejectionReason: "verification_incomplete",
    };
  }

  // Check cooling-off period
  if (request.status === "cooling_off" && request.coolingOffStartedAt) {
    const elapsedSeconds = Math.floor((context.now - request.coolingOffStartedAt) / 1000);
    const remainingSeconds = Math.max(0, request.coolingOffDurationSeconds - elapsedSeconds);

    if (remainingSeconds > 0) {
      return {
        canExecute: false,
        status: "cooling_off",
        message: `Beneficiary change is in cooling-off period (${remainingSeconds}s remaining).`,
        missingSteps: [],
        remainingCoolingOffSeconds: remainingSeconds,
        rejectionReason: "cooling_off_active",
      };
    }
  }

  return {
    canExecute: true,
    status: "verified_active",
    message: "Beneficiary change verification workflow complete and ready to execute.",
    missingSteps: [],
    remainingCoolingOffSeconds: 0,
  };
}

export class BeneficiaryChangeWorkflowError extends Error {
  decision: BeneficiaryChangeDecision;

  constructor(decision: BeneficiaryChangeDecision) {
    super(decision.message);
    this.name = "BeneficiaryChangeWorkflowError";
    this.decision = decision;
  }
}

/**
 * Asserts that a beneficiary change can be executed.
 */
export function assertBeneficiaryChangeExecutable(
  request: BeneficiaryChangeRequest,
  context: WorkflowEvaluationContext,
  policy: BeneficiaryChangeWorkflowPolicy = DEFAULT_BENEFICIARY_WORKFLOW_POLICY,
): void {
  const decision = evaluateBeneficiaryChangeReadiness(request, context, policy);
  if (!decision.canExecute) {
    throw new BeneficiaryChangeWorkflowError(decision);
  }
}
