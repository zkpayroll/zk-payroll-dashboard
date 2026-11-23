/**
 * Validation for beneficiary changes
 */

export interface BeneficiaryValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a Stellar public key format
 */
export function isValidStellarAddress(address: string): boolean {
  // Stellar public keys: 56 chars starting with G
  if (!address || typeof address !== 'string') return false;
  if (address.length !== 56) return false;
  if (!address.startsWith('G')) return false;
  // Reject degenerate/all-zero key format
  if (address === 'G' + 'A'.repeat(55)) return false;
  // Basic alphanumeric check: G followed by 55 characters in [A-Z2-7]
  return /^G[A-Z2-7]{55}$/.test(address);
}

/**
 * Validates beneficiary change inputs
 */
export function validateBeneficiaryChange(
  newAddress: string,
  currentAddress: string
): BeneficiaryValidationResult {
  const errors: string[] = [];

  if (!newAddress || newAddress.trim() === '') {
    errors.push('Beneficiary address is required');
    return { valid: false, errors };
  }

  if (!isValidStellarAddress(newAddress)) {
    errors.push('Invalid Stellar address format');
  }

  if (newAddress === currentAddress) {
    errors.push('New beneficiary must differ from current beneficiary');
  }

  if (newAddress === 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5H7') {
    // Zero address
    errors.push('Cannot use null/zero address as beneficiary');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates beneficiary change confirmation
 */
export function validateBeneficiaryConfirmation(
  confirmed: boolean,
  understood: boolean
): BeneficiaryValidationResult {
  const errors: string[] = [];

  if (!confirmed) {
    errors.push('You must confirm the beneficiary change');
  }

  if (!understood) {
    errors.push('You must understand the version impact');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates recovery inputs
 */
export function validateBeneficiaryRecovery(
  recoveryCode: string,
  adminConfirmed: boolean
): BeneficiaryValidationResult {
  const errors: string[] = [];

  if (!recoveryCode || recoveryCode.trim() === '') {
    errors.push('Recovery code is required');
  }

  if (!adminConfirmed) {
    errors.push('Administrator confirmation is required');
  }

  if (recoveryCode && !/^[A-Z0-9]{32}$/.test(recoveryCode)) {
    errors.push('Invalid recovery code format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
