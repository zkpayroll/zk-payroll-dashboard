/**
 * Dashboard pay group effective date validation (#733).
 *
 * Validates that a new or amended pay group's effective date satisfies
 * operational constraints: it must be a real calendar date, in the future,
 * not before the previous pay group's effective date, and not during an
 * active payroll run period.
 *
 * Privacy guarantees: no salary amounts, employee IDs, or wallet addresses
 * are read or emitted. Only date comparisons are performed.
 */

export interface PayrollGroupEffectiveDateInput {
  /** ISO date string for the new pay group's effective date. */
  readonly proposedEffectiveDate: string;
  /** ISO date string of the most recent active pay group's effective date, if any. */
  readonly currentPayGroupEffectiveDate?: string | null;
  /** ISO date string representing the start of the current active payroll run period. */
  readonly activeRunPeriodStart?: string | null;
  /** ISO date string representing the end of the current active payroll run period. */
  readonly activeRunPeriodEnd?: string | null;
  /** Current time as an ISO timestamp; defaults to the system clock. */
  readonly now?: string;
}

export interface PayrollGroupEffectiveDateValidationResult {
  readonly isValid: boolean;
  readonly error: string | null;
}

const ONE_DAY_MS = 86_400_000;

function parseIsoDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Returns a validation result for a proposed pay group effective date. */
export function validatePayrollGroupEffectiveDate(
  input: PayrollGroupEffectiveDateInput,
): PayrollGroupEffectiveDateValidationResult {
  const proposed = parseIsoDate(input.proposedEffectiveDate);
  if (proposed === null) {
    return { isValid: false, error: "Pay group effective date is not a valid date." };
  }

  const now = input.now ? parseIsoDate(input.now) ?? new Date() : new Date();
  // A pay group cannot take effect on or before today; changes apply to future
  // pay periods only so committed runs are not rewritten.
  if (proposed.getTime() <= now.getTime()) {
    return {
      isValid: false,
      error: "Pay group effective date must be in the future.",
    };
  }

  if (input.currentPayGroupEffectiveDate) {
    const current = parseIsoDate(input.currentPayGroupEffectiveDate);
    if (current !== null && proposed.getTime() <= current.getTime()) {
      return {
        isValid: false,
        error:
          "Pay group effective date must be after the current pay group's effective date.",
      };
    }
  }

  if (input.activeRunPeriodStart && input.activeRunPeriodEnd) {
    const periodStart = parseIsoDate(input.activeRunPeriodStart);
    const periodEnd = parseIsoDate(input.activeRunPeriodEnd);
    if (periodStart !== null && periodEnd !== null) {
      // Effective dates on either boundary of an active run still collide with
      // that run's settlement window, so treat the run period as inclusive.
      if (proposed.getTime() >= periodStart.getTime() && proposed.getTime() <= periodEnd.getTime()) {
        return {
          isValid: false,
          error:
            "Pay group effective date falls within an active payroll run period and cannot be applied until the run completes.",
        };
      }
    }
  }

  return { isValid: true, error: null };
}

/** Boolean convenience wrapper around {@link validatePayrollGroupEffectiveDate}. */
export function isPayrollGroupEffectiveDateValid(
  input: PayrollGroupEffectiveDateInput,
): boolean {
  return validatePayrollGroupEffectiveDate(input).isValid;
}
