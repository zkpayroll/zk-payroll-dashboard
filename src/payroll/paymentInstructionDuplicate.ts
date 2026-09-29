/**
 * Payment instruction duplicate detection domain module (#633).
 *
 * Provides domain-level duplicate detection, actionable validation errors, and
 * privacy-safe reporting for payment instructions in the dashboard layer.
 *
 * Privacy Guarantees:
 * - Stellar addresses are masked by default (`GDQP2K…4W37`).
 * - Raw salary amounts and private employee details are never leaked in error titles.
 * - Actionable validation errors indicate operational blockers with clean remediation copy.
 */

export {
  maskPaymentAddress,
  getInstructionId,
  getInstructionRecipientId,
  getInstructionAddress,
  getInstructionAmount,
  getInstructionAsset,
  employeeToPaymentInstruction,
  findPaymentInstructionDuplicates,
  validatePaymentInstructions,
  isDuplicatePaymentInstruction,
  findDuplicateEmployeeWarnings,
  type PaymentInstruction,
  type PaymentInstructionDuplicateKind,
  type PaymentInstructionDuplicateGroup,
  type PaymentInstructionDuplicateOptions,
  type PaymentInstructionValidationResult,
  type DuplicateWarningKind,
  type DuplicateWarningGroup,
} from "@/lib/duplicateDetection";
