import type { PayrollRun } from "@/types/models";
import type {
  SalaryCommitmentAmendment,
  AmendmentSafeDiff,
  AmendmentPlanValidation,
} from "@/lib/sdk/amendments";
import {
  getAmendmentSafeDiff,
  validateAmendmentPlan,
} from "@/lib/sdk/amendments";
import { AMENDMENT_PRIVACY_NOTICE } from "@/lib/privacy/amendments";

export interface PayrollRunAmendmentReviewResult {
  originalRun: ReadOnlyPayrollRun;
  amendment: SalaryCommitmentAmendment;
  safeDiff: AmendmentSafeDiff;
  validation: AmendmentPlanValidation;
  isOriginalPreserved: boolean;
  privacyNotice: string;
  warning?: string;
}

export type ReadOnlyPayrollRun = Readonly<PayrollRun>;

/**
 * Validates that an amendment review does not mutate or overwrite the original payroll run record.
 */
export function assertOriginalRecordIntact(
  originalRun: PayrollRun,
  currentRun: PayrollRun
): { isIntact: boolean; error?: string } {
  const isIdSame = originalRun.id === currentRun.id;
  const isStatusSame = originalRun.status === currentRun.status;
  const isAmountSame = originalRun.totalAmount === currentRun.totalAmount;
  const isCountSame = originalRun.employeeCount === currentRun.employeeCount;

  if (!isIdSame || !isStatusSame || !isAmountSame || !isCountSame) {
    return {
      isIntact: false,
      error: "Destructive action blocked: Original payroll record cannot be overwritten by amendment review.",
    };
  }

  return { isIntact: true };
}

/**
 * Creates a privacy-safe amendment review bundle for dashboard review,
 * ensuring the original payroll run record is preserved in a read-only snapshot.
 */
export function createPayrollRunAmendmentReview(
  originalRun: PayrollRun,
  amendment: SalaryCommitmentAmendment
): PayrollRunAmendmentReviewResult {
  // Deep clone original run to prevent accidental mutation
  const readOnlyRun: ReadOnlyPayrollRun = Object.freeze(
    JSON.parse(JSON.stringify(originalRun))
  );

  const safeDiff = getAmendmentSafeDiff(amendment);
  const validation = validateAmendmentPlan(amendment);

  let warning: string | undefined;
  if (validation.isStale) {
    warning = validation.blockedReason || "This amendment is stale. Original payroll run record remains active.";
  } else if (!validation.isPolicyValid) {
    warning = validation.blockedReason || "Amendment violates current policy. Original record remains active.";
  }

  return {
    originalRun: readOnlyRun,
    amendment,
    safeDiff,
    validation,
    isOriginalPreserved: true,
    privacyNotice: AMENDMENT_PRIVACY_NOTICE,
    warning,
  };
}
