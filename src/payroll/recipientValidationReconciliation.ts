/**
 * Recipient validation reconciliation (#728).
 *
 * Reconciles payment recipient information against external validation
 * sources, ensuring beneficiary addresses, account details, and contact
 * information remain accurate and up-to-date throughout the payroll lifecycle.
 *
 * Privacy guarantees: Raw employee identities and complete addresses are never
 * logged or exposed. Recipient data is masked or hashed in user-facing messages.
 */

export type ReconciliationStatus = "pending" | "in_progress" | "validated" | "discrepancy_found" | "resolved";

export type ValidationType = "address_verification" | "account_ownership" | "contact_validation";

export interface RecipientValidationPolicy {
  requireAddressVerification: boolean;
  requireAccountOwnershipProof: boolean;
  reconciliationTtlSeconds: number;
  allowManualOverride: boolean;
}

export const DEFAULT_RECIPIENT_VALIDATION_POLICY: RecipientValidationPolicy = {
  requireAddressVerification: true,
  requireAccountOwnershipProof: true,
  reconciliationTtlSeconds: 2592000, // 30 days
  allowManualOverride: true,
};

export interface RecipientRecord {
  id: string;
  employeeRef: string;
  payrollRunId: string;
  addressMasked: string;
  accountIdMasked: string;
  status: ReconciliationStatus;
  recordedAt: number;
  validatedAt?: number;
  completedValidations: ValidationType[];
  discrepancies?: string[];
  resolvedAt?: number;
  resolutionNotes?: string;
}

export interface CreateRecipientRecordInput {
  id: string;
  employeeRef: string;
  payrollRunId: string;
  addressMasked: string;
  accountIdMasked: string;
  now?: number;
  policy?: Partial<RecipientValidationPolicy>;
}

export interface ReconciliationEvaluation {
  isValid: boolean;
  status: ReconciliationStatus;
  message: string;
  completedValidations: ValidationType[];
  remainingValidations: ValidationType[];
  requiresAction: boolean;
}

/**
 * Masks a recipient address for privacy.
 */
export function maskRecipientAddress(address: string): string {
  if (!address || address.length < 10) return "*".repeat(8);
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}

/**
 * Masks an account identifier for privacy.
 */
export function maskAccountId(accountId: string): string {
  if (!accountId || accountId.length < 8) return "*".repeat(8);
  return `${accountId.slice(0, 4)}...${accountId.slice(-4)}`;
}

/**
 * Creates a new recipient validation record.
 */
export function createRecipientRecord(input: CreateRecipientRecordInput): RecipientRecord {
  if (!input.id || input.id.trim().length === 0) {
    throw new Error("Recipient record id must be provided");
  }
  if (!input.employeeRef || input.employeeRef.trim().length === 0) {
    throw new Error("Employee reference must be provided");
  }
  if (!input.payrollRunId || input.payrollRunId.trim().length === 0) {
    throw new Error("Payroll run id must be provided");
  }
  if (!input.addressMasked || input.addressMasked.trim().length === 0) {
    throw new Error("Address must be provided");
  }
  if (!input.accountIdMasked || input.accountIdMasked.trim().length === 0) {
    throw new Error("Account id must be provided");
  }

  const policy = { ...DEFAULT_RECIPIENT_VALIDATION_POLICY, ...input.policy };

  return {
    id: input.id.trim(),
    employeeRef: input.employeeRef.trim(),
    payrollRunId: input.payrollRunId.trim(),
    addressMasked: input.addressMasked,
    accountIdMasked: input.accountIdMasked,
    status: "pending",
    recordedAt: input.now ?? Date.now(),
    completedValidations: [],
  };
}

/**
 * Submits a validation result for a recipient.
 */
export function submitValidation(
  record: RecipientRecord,
  validationType: ValidationType,
  isValid: boolean,
  now = Date.now(),
  policy: RecipientValidationPolicy = DEFAULT_RECIPIENT_VALIDATION_POLICY,
): RecipientRecord {
  if (record.status === "resolved" || record.status === "validated") {
    throw new Error(`Cannot submit validation for record with status '${record.status}'`);
  }

  const updatedValidations = Array.from(new Set([...record.completedValidations, validationType]));

  const requiredValidations: ValidationType[] = [];
  if (policy.requireAddressVerification) requiredValidations.push("address_verification");
  if (policy.requireAccountOwnershipProof) requiredValidations.push("account_ownership");
  requiredValidations.push("contact_validation");

  const allCompleted = requiredValidations.every((v) => updatedValidations.includes(v));
  const hasDiscrepancy = record.discrepancies && record.discrepancies.length > 0;

  return {
    ...record,
    completedValidations: updatedValidations,
    status: hasDiscrepancy ? "discrepancy_found" : allCompleted ? "validated" : "in_progress",
    validatedAt: allCompleted && !hasDiscrepancy ? now : record.validatedAt,
  };
}

/**
 * Records a discrepancy in recipient validation.
 */
export function recordDiscrepancy(
  record: RecipientRecord,
  discrepancy: string,
  now = Date.now(),
): RecipientRecord {
  if (!discrepancy || discrepancy.trim().length === 0) {
    throw new Error("Discrepancy description must be provided");
  }

  const updatedDiscrepancies = Array.from(new Set([...(record.discrepancies ?? []), discrepancy]));

  return {
    ...record,
    status: "discrepancy_found",
    discrepancies: updatedDiscrepancies,
  };
}

/**
 * Resolves a recipient validation record.
 */
export function resolveRecipientValidation(
  record: RecipientRecord,
  notes: string,
  now = Date.now(),
): RecipientRecord {
  if (!notes || notes.trim().length === 0) {
    throw new Error("Resolution notes must be provided");
  }

  return {
    ...record,
    status: "resolved",
    resolvedAt: now,
    resolutionNotes: notes,
  };
}

/**
 * Evaluates a recipient validation record.
 */
export function evaluateRecipientValidation(
  record: RecipientRecord,
  policy: RecipientValidationPolicy = DEFAULT_RECIPIENT_VALIDATION_POLICY,
): ReconciliationEvaluation {
  const requiredValidations: ValidationType[] = [];
  if (policy.requireAddressVerification) requiredValidations.push("address_verification");
  if (policy.requireAccountOwnershipProof) requiredValidations.push("account_ownership");
  requiredValidations.push("contact_validation");

  const remainingValidations = requiredValidations.filter((v) => !record.completedValidations.includes(v));

  let message = "";
  switch (record.status) {
    case "pending":
      message = "Recipient validation pending. No validations started.";
      break;
    case "in_progress":
      message = `Recipient validation in progress. ${remainingValidations.length} validation(s) remaining.`;
      break;
    case "validated":
      message = "Recipient validation completed successfully.";
      break;
    case "discrepancy_found":
      message = `${record.discrepancies?.length ?? 0} discrepancy(ies) found in recipient data.`;
      break;
    case "resolved":
      message = "Recipient validation resolved.";
      break;
  }

  return {
    isValid: record.status === "validated",
    status: record.status,
    message,
    completedValidations: record.completedValidations,
    remainingValidations,
    requiresAction: remainingValidations.length > 0 || record.status === "discrepancy_found",
  };
}
