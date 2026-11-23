import { describe, it, expect } from 'vitest';
import {
  isValidStellarAddress,
  validateBeneficiaryChange,
  validateBeneficiaryConfirmation,
  validateBeneficiaryRecovery,
} from '../lib/beneficiary-validation';

describe('Beneficiary Validation', () => {
  describe('isValidStellarAddress', () => {
    it('accepts valid Stellar public key', () => {
      const validAddress = 'GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IAMRU5MPJUJJZI7DNVMD56';
      expect(isValidStellarAddress(validAddress)).toBe(true);
    });

    it('rejects invalid format', () => {
      expect(isValidStellarAddress('invalid')).toBe(false);
      expect(isValidStellarAddress('G' + 'A'.repeat(55))).toBe(false);
      expect(isValidStellarAddress('')).toBe(false);
      expect(isValidStellarAddress('1234567890123456789012345678901234567890123456789012345')).toBe(false);
      // Boundary: 55 chars (one short) and 57 chars (one long)
      expect(isValidStellarAddress('GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IAMRU5MPJUJJZI7DNVMD5')).toBe(false);
      expect(isValidStellarAddress('GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IAMRU5MPJUJJZI7DNVMD567')).toBe(false);
      // Non-base32 characters (0, 1, 8, 9 are not in RFC4648 Base32)
      expect(isValidStellarAddress('GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IAMRU5MPJUJJZI7DNVMD58')).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(isValidStellarAddress(null as any)).toBe(false);
      expect(isValidStellarAddress(undefined as any)).toBe(false);
    });
  });

  describe('validateBeneficiaryChange', () => {
    const currentAddress = 'GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IAMRU5MPJUJJZI7DNVMD56';
    const newAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF7E';

    it('accepts valid beneficiary change', () => {
      const result = validateBeneficiaryChange(newAddress, currentAddress);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty address', () => {
      const result = validateBeneficiaryChange('', currentAddress);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Beneficiary address is required');
    });

    it('rejects same address', () => {
      const result = validateBeneficiaryChange(currentAddress, currentAddress);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('differ from current'))).toBe(true);
    });

    it('rejects invalid address', () => {
      const result = validateBeneficiaryChange('invalid-address', currentAddress);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid'))).toBe(true);
    });

    it('rejects null/zero address as beneficiary', () => {
      const result = validateBeneficiaryChange('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5H7', currentAddress);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot use null/zero address as beneficiary');
    });
  });

  describe('validateBeneficiaryConfirmation', () => {
    it('accepts confirmed and understood change', () => {
      const result = validateBeneficiaryConfirmation(true, true);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects unconfirmed change', () => {
      const result = validateBeneficiaryConfirmation(false, true);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('You must confirm the beneficiary change');
    });

    it('rejects unacknowledged impact', () => {
      const result = validateBeneficiaryConfirmation(true, false);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('You must understand the version impact');
    });
  });

  describe('validateBeneficiaryRecovery', () => {
    it('accepts valid recovery', () => {
      const result = validateBeneficiaryRecovery('ABCDEF0123456789ABCDEF0123456789', true);
      expect(result.valid).toBe(true);
    });

    it('rejects empty recovery code', () => {
      const result = validateBeneficiaryRecovery('', true);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Recovery code is required');
    });

    it('rejects unconfirmed recovery', () => {
      const result = validateBeneficiaryRecovery('ABCDEF0123456789ABCDEF0123456789', false);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Administrator confirmation is required');
    });

    it('rejects malformed recovery codes (boundary length and characters)', () => {
      // 31 characters (one short)
      expect(validateBeneficiaryRecovery('ABCDEF0123456789ABCDEF01234567', true).valid).toBe(false);
      // 33 characters (one long)
      expect(validateBeneficiaryRecovery('ABCDEF0123456789ABCDEF0123456789X', true).valid).toBe(false);
      // Non-uppercase / special characters
      expect(validateBeneficiaryRecovery('abcdef0123456789abcdef0123456789', true).valid).toBe(false);
      expect(validateBeneficiaryRecovery('ABCDEF0123456789ABCDEF012345678!', true).valid).toBe(false);
    });
  });
});
