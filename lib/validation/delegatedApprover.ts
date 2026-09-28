/**
 * Validation logic for delegated approver input.
 *
 * Privacy: This module NEVER formats or includes sensitive payroll details
 * (salaries, employee names, payment amounts, or financial details) in error messages.
 */

/** Stellar public keys start with G and are 56 uppercase alphanumeric characters. */
export const STELLAR_ADDRESS_REGEX = /^G[A-Z0-9]{55}$/;

/** Valid fallback identifier format for delegators (e.g., delegate-1, admin-vault-01). */
export const DELEGATE_IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

export interface DelegatedApproverValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Validates a candidate delegated approver address or identifier.
 *
 * Checks:
 * 1. Non-empty string
 * 2. Format matches a valid Stellar address (G...) or standard delegate identifier
 * 3. Not a duplicate of an existing delegated approver (case-insensitive)
 */
export function validateDelegatedApproverInput(
  input: string,
  existingAddresses: string[] = [],
): DelegatedApproverValidationResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: "Approver address or identifier is required.",
    };
  }

  const isStellarAddress = STELLAR_ADDRESS_REGEX.test(trimmed);
  const isDelegateIdentifier = DELEGATE_IDENTIFIER_REGEX.test(trimmed);

  if (!isStellarAddress && !isDelegateIdentifier) {
    return {
      isValid: false,
      error:
        "Invalid address format. Must be a valid Stellar address (starting with G, 56 characters) or identifier.",
    };
  }

  const isDuplicate = existingAddresses.some(
    (existing) => existing.trim().toLowerCase() === trimmed.toLowerCase(),
  );

  if (isDuplicate) {
    return {
      isValid: false,
      error: "Duplicate approver address or identifier already exists.",
    };
  }

  return {
    isValid: true,
    error: null,
  };
}
