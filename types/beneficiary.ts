/**
 * Public types for Beneficiary Changes UI Behavior (#906).
 *
 * Re-exports domain, guidance, status, and validation types for beneficiary
 * changes and payout destination workflows across the ZK Payroll Dashboard.
 */

export type {
  BeneficiaryChangeStatus,
  VerificationStepType,
  BeneficiaryChangeWorkflowPolicy,
  BeneficiaryChangeRequest,
  CreateBeneficiaryChangeInput,
  WorkflowEvaluationContext,
  BeneficiaryChangeDecision,
} from "@/src/payroll/beneficiaryChangeVerificationWorkflow";

export {
  DEFAULT_BENEFICIARY_WORKFLOW_POLICY,
  BeneficiaryChangeWorkflowError,
  maskAddress,
  createBeneficiaryChangeRequest,
  submitVerificationStep,
  evaluateBeneficiaryChangeReadiness,
  assertBeneficiaryChangeExecutable,
} from "@/src/payroll/beneficiaryChangeVerificationWorkflow";

export type {
  BeneficiaryChangeGuidanceTone,
  BeneficiaryChangeGuidance,
} from "@/lib/employees/beneficiaryChangeGuidance";

export {
  describeBeneficiaryChangeGuidance,
  formatCoolingOff,
} from "@/lib/employees/beneficiaryChangeGuidance";

export type {
  BeneficiaryVerificationStatus,
  BeneficiaryVerificationStatusEvaluation,
} from "@/lib/payroll/beneficiaryVerificationStatus";

export {
  evaluateBeneficiaryVerificationStatus,
} from "@/lib/payroll/beneficiaryVerificationStatus";

export type {
  BeneficiaryValidationResult,
} from "@/lib/beneficiary-validation";

export {
  isValidStellarAddress,
  validateBeneficiaryChange,
  validateBeneficiaryConfirmation,
  validateBeneficiaryRecovery,
} from "@/lib/beneficiary-validation";
