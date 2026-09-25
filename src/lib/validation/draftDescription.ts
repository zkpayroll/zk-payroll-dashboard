/**
 * External payroll draft description validation.
 *
 * Description fields are optional helper text for a payroll batch.
 * Guidance prevents PII such as salary amounts or financial figures.
 *
 * Privacy-safe: limits length and checks for currency symbols to discourage PII.
 */

export const DESCRIPTION_MAX_LENGTH = 255;
export const DESCRIPTION_HINT =
  "Optional description for this payroll draft. Do not include employee names, salary amounts, or other sensitive personal information.";

export interface DraftDescriptionValidationResult {
  isValid: boolean;
  message: string | null;
}

/**
 * Validate a draft description's format (length, PII heuristics).
 */
export function validateDraftDescription(raw: string): DraftDescriptionValidationResult {
  if (!raw || raw.trim().length === 0) {
    return { isValid: true, message: null };
  }

  if (raw.length > DESCRIPTION_MAX_LENGTH) {
    return { isValid: false, message: `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.` };
  }

  // Basic heuristic check to discourage PII - looking for $, €, or £ symbols which might indicate salary amounts
  if (/[\$€£]/.test(raw)) {
    return { isValid: false, message: "Please do not include salary amounts or financial figures in the description." };
  }

  return { isValid: true, message: null };
}
