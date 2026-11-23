import type { PayrollWizardStep } from "@/types";

export type SubmissionSequenceInput = {
  currentStep: PayrollWizardStep;
  proofStatus: "idle" | "generating" | "success" | "error";
  submissionStatus: "idle" | "submitting" | "success" | "error";
  transactionHash?: string | null;
};

/** Returns a privacy-safe, actionable message for an incomplete submit flow. */
export function getSubmissionSequenceWarning(
  input: SubmissionSequenceInput,
): string | null {
  if (input.currentStep !== "submit") return null;
  if (input.proofStatus !== "success") {
    return "Submission is out of sequence. Return to payroll review, generate and verify a proof, then confirm the payroll before submitting.";
  }
  if (input.submissionStatus === "idle") {
    return "Submission is not ready yet. Return to payroll review and complete the confirmation step before trying again.";
  }
  if (input.submissionStatus === "success" && !input.transactionHash) {
    return "Submission confirmation is incomplete. Check transaction history before starting another payroll submission.";
  }
  return null;
}
