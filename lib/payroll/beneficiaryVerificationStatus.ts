import {
  DEFAULT_BENEFICIARY_WORKFLOW_POLICY,
  evaluateBeneficiaryChangeReadiness,
  type BeneficiaryChangeRequest,
  type BeneficiaryChangeWorkflowPolicy,
  type WorkflowEvaluationContext,
} from "@/src/payroll/beneficiaryChangeVerificationWorkflow";

export type BeneficiaryVerificationStatus = "ready" | "pending" | "blocked";

export interface BeneficiaryVerificationStatusEvaluation {
  status: BeneficiaryVerificationStatus;
  totalRequests: number;
  /** Verified and past cooling-off: safe to execute. */
  readyCount: number;
  /** Still waiting on verification steps or the cooling-off period. */
  pendingCount: number;
  /** Rejected or expired: needs a new request. */
  blockedCount: number;
  summaryMessage: string;
}

/**
 * Summarises beneficiary change requests for the dashboard (#736).
 *
 * Each request is judged by the existing readiness rules, so this never
 * re-implements them. The output carries counts and a message only, with no
 * employee references or addresses.
 */
export function evaluateBeneficiaryVerificationStatus(
  requests: readonly BeneficiaryChangeRequest[],
  context: WorkflowEvaluationContext,
  policy: BeneficiaryChangeWorkflowPolicy = DEFAULT_BENEFICIARY_WORKFLOW_POLICY,
): BeneficiaryVerificationStatusEvaluation {
  let readyCount = 0;
  let pendingCount = 0;
  let blockedCount = 0;

  for (const request of requests) {
    const decision = evaluateBeneficiaryChangeReadiness(request, context, policy);
    if (decision.status === "verified_active") {
      readyCount++;
    } else if (decision.status === "rejected" || decision.status === "expired") {
      blockedCount++;
    } else {
      pendingCount++;
    }
  }

  let status: BeneficiaryVerificationStatus = "ready";
  let summaryMessage = "No beneficiary changes are awaiting verification.";
  if (blockedCount > 0) {
    status = "blocked";
    summaryMessage = `${blockedCount} beneficiary change${blockedCount === 1 ? "" : "s"} rejected or expired. Submit a new request to proceed.`;
  } else if (pendingCount > 0) {
    status = "pending";
    summaryMessage = `${pendingCount} beneficiary change${pendingCount === 1 ? "" : "s"} still need verification or cooling-off to finish.`;
  } else if (readyCount > 0) {
    summaryMessage = `${readyCount} verified beneficiary change${readyCount === 1 ? "" : "s"} ready to execute.`;
  }

  return {
    status,
    totalRequests: requests.length,
    readyCount,
    pendingCount,
    blockedCount,
    summaryMessage,
  };
}
