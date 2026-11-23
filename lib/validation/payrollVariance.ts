export interface PayrollVarianceValidationResult {
  isValid: boolean;
  variance: number;
  message: string | null;
}

/** Validates that a payroll total stays within the configured variance threshold. */
export function validatePayrollVariance(
  expectedTotal: number,
  actualTotal: number,
  threshold: number,
): PayrollVarianceValidationResult {
  if (![expectedTotal, actualTotal, threshold].every(Number.isFinite)) {
    return { isValid: false, variance: Number.NaN, message: 'Payroll totals and threshold must be finite numbers.' };
  }

  if (expectedTotal < 0 || actualTotal < 0 || threshold < 0) {
    return { isValid: false, variance: Math.abs(actualTotal - expectedTotal), message: 'Payroll totals and threshold cannot be negative.' };
  }

  const variance = Math.abs(actualTotal - expectedTotal);
  if (variance > threshold) {
    return {
      isValid: false,
      variance,
      message: `Payroll variance of ${variance} exceeds the configured threshold of ${threshold}.`,
    };
  }

  return { isValid: true, variance, message: null };
}