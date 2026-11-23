/**
 * Payroll policy effective-date guardrails module (#670).
 *
 * Validates that a new or amended payroll policy's effective date satisfies
 * operational constraints: it must be in the future, not before the previous
 * policy's effective date, and not during an active payroll run period.
 *
 * Privacy guarantees: no salary amounts, employee IDs, or wallet addresses
 * are read or emitted. Only date comparisons are performed.
 */

export interface PolicyEffectiveDateInput {
  /** ISO date string for the new policy's effective date. */
  readonly proposedEffectiveDate: string;
  /** ISO date string of the most recent active policy's effective date, if any. */
  readonly currentPolicyEffectiveDate?: string | null;
  /** ISO date string representing the start of the current active payroll run period. */
  readonly activeRunPeriodStart?: string | null;
  /** ISO date string representing the end of the current active payroll run period. */
  readonly activeRunPeriodEnd?: string | null;
}

export interface PolicyEffectiveDateValidationResult {
  readonly isValid: boolean;
  readonly error: string | null;
}

/** Returns a validation result for a proposed policy effective date. */
export function validatePolicyEffectiveDate(
  input: PolicyEffectiveDateInput,
): PolicyEffectiveDateValidationResult {
  const proposed = new Date(input.proposedEffectiveDate);

  if (isNaN(proposed.getTime())) {
    return { isValid: false, error: "Proposed effective date is not a valid date." };
  }

  const now = new Date();
  if (proposed <= now) {
    return {
      isValid: false,
      error: "Policy effective date must be in the future.",
    };
  }

  if (input.currentPolicyEffectiveDate) {
    const current = new Date(input.currentPolicyEffectiveDate);
    if (!isNaN(current.getTime()) && proposed <= current) {
      return {
        isValid: false,
        error: "Policy effective date must be after the current policy's effective date.",
      };
    }
  }

  if (input.activeRunPeriodStart && input.activeRunPeriodEnd) {
    const periodStart = new Date(input.activeRunPeriodStart);
    const periodEnd = new Date(input.activeRunPeriodEnd);
    if (!isNaN(periodStart.getTime()) && !isNaN(periodEnd.getTime())) {
      if (proposed >= periodStart && proposed <= periodEnd) {
        return {
          isValid: false,
          error: "Policy effective date falls within an active payroll run period and cannot be applied until the run completes.",
        };
      }
    }
  }

  return { isValid: true, error: null };
}
