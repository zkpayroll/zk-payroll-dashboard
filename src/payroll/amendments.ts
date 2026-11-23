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
  draftValidation: AmendmentDraftValidation;
  isOriginalPreserved: boolean;
  privacyNotice: string;
  warning?: string;
}

export type ReadOnlyPayrollRun = Readonly<PayrollRun>;

export interface AmendmentDraftValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AmendmentDraftInput {
  id?: string;
  employeeId: string;
  employeeReference: string;
  previousVersion: number;
  commitmentVersion: number;
  previousCommitment: string;
  nextCommitment: string;
  period: string;
  approvalStatus: string;
  reason?: string;
}

/**
 * Validates a payroll run amendment draft before it enters the review
 * workflow, producing actionable errors an operator can fix without
 * regressing the original run. Salary values are never included in
 * error text.
 */
export function validateAmendmentDraft(
  draft: AmendmentDraftInput,
  originalRun?: Pick<PayrollRun, "id" | "employeeIds">,
): AmendmentDraftValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.employeeId?.trim()) {
    errors.push(
      "Employee ID is required. Provide the payroll employee identifier this amendment targets.",
    );
  }
  if (!draft.employeeReference?.trim()) {
    errors.push(
      "Privacy-safe employee reference is required so maintainers can review without salary values.",
    );
  }
  if (!draft.previousCommitment?.trim()) {
    errors.push(
      "Previous commitment hash is required. Refresh the amendment against the latest on-chain commitment.",
    );
  }
  if (!draft.nextCommitment?.trim()) {
    errors.push(
      "Next commitment hash is required. Generate the encrypted commitment before submitting.",
    );
  }
  if (
    draft.previousCommitment?.trim() &&
    draft.nextCommitment?.trim() &&
    draft.previousCommitment.trim() === draft.nextCommitment.trim()
  ) {
    errors.push(
      "No-op amendment blocked: the proposed commitment matches the current commitment. There is nothing to approve.",
    );
  }
  if (
    !Number.isInteger(draft.previousVersion) ||
    !Number.isInteger(draft.commitmentVersion) ||
    draft.commitmentVersion !== draft.previousVersion + 1
  ) {
    errors.push(
      `Commitment version must advance exactly one step (v${draft.previousVersion} → v${draft.previousVersion + 1}). Regenerate the amendment from the latest on-chain version.`,
    );
  }
  if (!draft.period?.trim()) {
    errors.push(
      "Payroll period is required so the amendment is applied to the correct cycle.",
    );
  }
  if (draft.approvalStatus !== "pending") {
    errors.push(
      `Only pending amendments can be submitted for review (this one is "${draft.approvalStatus}"). Create a new pending amendment instead.`,
    );
  }
  if (
    originalRun &&
    Array.isArray(originalRun.employeeIds) &&
    originalRun.employeeIds.length > 0 &&
    draft.employeeId?.trim() &&
    !originalRun.employeeIds.includes(draft.employeeId)
  ) {
    errors.push(
      `Employee ${draft.employeeId} is not part of payroll run ${originalRun.id}. Verify the employee roster before amending.`,
    );
  }

  if (!draft.reason?.trim()) {
    warnings.push(
      "Add a rationale so reviewers understand the change without seeing salary values.",
    );
  }

  return { isValid: errors.length === 0, errors, warnings };
}

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
  const draftValidation = validateAmendmentDraft(amendment, originalRun);

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
    draftValidation,
    isOriginalPreserved: true,
    privacyNotice: AMENDMENT_PRIVACY_NOTICE,
    warning,
  };
}
