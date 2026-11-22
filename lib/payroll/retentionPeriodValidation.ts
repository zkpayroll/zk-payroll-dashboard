/**
 * Validation rules for the audit log retention period (days).
 * Shared by the retention UI and the policy compiler so both enforce the same range.
 * Messages are generic: they never echo the entered value or any payroll data.
 */
export const RETENTION_PERIOD_MIN_DAYS = 30;
export const RETENTION_PERIOD_MAX_DAYS = 3650;
export const RETENTION_PERIOD_RECOMMENDED_DAYS = 365;

export type RetentionPeriodValidation = { valid: true } | { valid: false; reason: string };

export function validateRetentionPeriodDays(value: unknown): RetentionPeriodValidation {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      valid: false,
      reason: "Enter the retention period as a number of days. Empty or non-numeric entries cannot be saved.",
    };
  }
  if (!Number.isInteger(value)) {
    return {
      valid: false,
      reason: `Use a whole number of days, for example ${RETENTION_PERIOD_RECOMMENDED_DAYS}. Decimal values cannot be saved.`,
    };
  }
  if (value < RETENTION_PERIOD_MIN_DAYS) {
    return {
      valid: false,
      reason: `Increase the period to at least ${RETENTION_PERIOD_MIN_DAYS} days to meet the minimum retention requirement.`,
    };
  }
  if (value > RETENTION_PERIOD_MAX_DAYS) {
    return {
      valid: false,
      reason: `Reduce the period to ${RETENTION_PERIOD_MAX_DAYS} days (10 years) or fewer.`,
    };
  }
  return { valid: true };
}
