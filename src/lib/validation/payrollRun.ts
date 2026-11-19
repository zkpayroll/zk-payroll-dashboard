/** Payroll run identifiers are opaque, lowercase identifiers for tracking payroll batches. */
const PAYROLL_RUN_ID_PATTERN = /^run_[a-z0-9][a-z0-9_-]{2,127}$/;

export const PAYROLL_RUN_FORMAT_HINT =
  "Expected format: run_<identifier> (lowercase letters, numbers, _ or -).";

export interface PayrollRunValidationResult {
  isValid: boolean;
  normalized: string;
  message: string | null;
}

export function normalizePayrollRunId(raw: string | null | undefined): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function validatePayrollRunId(raw: string | null | undefined): PayrollRunValidationResult {
  const normalized = normalizePayrollRunId(raw);
  if (!normalized) {
    return { isValid: false, normalized, message: "Payroll run ID is missing." };
  }
  if (!PAYROLL_RUN_ID_PATTERN.test(normalized)) {
    return {
      isValid: false,
      normalized,
      message: `Invalid payroll run ID. ${PAYROLL_RUN_FORMAT_HINT}`,
    };
  }
  return { isValid: true, normalized, message: null };
}
