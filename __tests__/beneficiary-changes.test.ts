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
  });
});
