import type {
  BeneficiaryChangeDecision,
  VerificationStepType,
} from "@/src/payroll/beneficiaryChangeVerificationWorkflow";

export type BeneficiaryChangeGuidanceTone = "info" | "warning" | "blocked" | "ready";

export interface BeneficiaryChangeGuidance {
  tone: BeneficiaryChangeGuidanceTone;
  title: string;
  body: string;
  /** Ordered actions the operator can take next. Empty when none apply. */
  nextSteps: string[];
}

const STEP_LABELS: Record<VerificationStepType, string> = {
  contributor_confirmation: "Ask the employee to confirm the change",
  two_factor_auth: "Complete two-factor verification",
  dual_operator_signoff: "Get sign-off from a second operator",
};

/** Human-readable length of a cooling-off period, rounded up to the next whole unit. */
export function formatCoolingOff(seconds: number): string {
  if (seconds <= 0) return "0 minutes";
  const hours = Math.ceil(seconds / 3600);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.ceil(seconds / 86400);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Turns a readiness decision into plain guidance for the operator (#902).
 *
 * Works only from the decision's status and missing steps, so it never
 * shows an address or employee detail. Wording avoids crypto jargon, in line
 * with the copy rules in docs/.
 */
export function describeBeneficiaryChangeGuidance(
  decision: BeneficiaryChangeDecision,
): BeneficiaryChangeGuidance {
  switch (decision.status) {
    case "verified_active":
      return {
        tone: "ready",
        title: "Beneficiary change is active",
        body: "The new beneficiary is verified and will be used for the next payroll.",
        nextSteps: [],
      };
    case "draft":
      return {
        tone: "info",
        title: "Request not submitted yet",
        body: "Submit the beneficiary change to start verification.",
        nextSteps: ["Submit the request"],
      };
    case "pending_verification": {
      const steps = decision.missingSteps.map((step) => STEP_LABELS[step]);
      return {
        tone: "info",
        title: "Verification in progress",
        body: steps.length > 0
          ? "The change cannot take effect until the steps below are complete."
          : "All verification steps are complete. The change moves to cooling-off next.",
        nextSteps: steps,
      };
    }
    case "cooling_off":
      return {
        tone: "warning",
        title: "Waiting for the cooling-off period",
        body: `The change takes effect in about ${formatCoolingOff(decision.remainingCoolingOffSeconds)}. This protects against a rushed change.`,
        nextSteps: ["Wait for the cooling-off period to end"],
      };
    case "rejected":
      return {
        tone: "blocked",
        title: "Beneficiary change rejected",
        body: decision.rejectionReason
          ? `Reason: ${decision.rejectionReason}.`
          : "This change was rejected and cannot take effect.",
        nextSteps: ["Submit a new request if the change is still needed"],
      };
    case "expired":
      return {
        tone: "blocked",
        title: "Verification window expired",
        body: "The verification steps were not completed in time, so the request has closed.",
        nextSteps: ["Submit a new request"],
      };
    default:
      return {
        tone: "info",
        title: "Beneficiary change status",
        body: decision.message,
        nextSteps: [],
      };
  }
}
