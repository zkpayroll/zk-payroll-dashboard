import { CompensationPolicy } from './policy';
import { PayrollPolicy } from '../types';

describe('CompensationPolicy', () => {
  const validPolicy: PayrollPolicy = {
    id: 'test-1',
    effectiveDate: new Date('2023-01-01'),
    compensation: 1000,
    currency: 'USD'
  };

  describe('validation', () => {
    it('should accept valid chronological policies', () => {
      const policies = [
        { ...validPolicy, effectiveDate: new Date('2023-01-01') },
        { ...validPolicy, effectiveDate: new Date('2023-02-01') }
      ];
      expect(() => CompensationPolicy.validate(policies)).not.toThrow();
    });

    it('should reject policies with null effective dates', () => {
      const invalidPolicy = { ...validPolicy, effectiveDate: null as any };
      expect(() => CompensationPolicy.validate([invalidPolicy])).toThrow('Effective date is required');
    });

    it('should reject out-of-order policies', () => {
      const policies = [
        { ...validPolicy, effectiveDate: new Date('2023-02-01') },
        { ...validPolicy, effectiveDate: new Date('2023-01-01') }
      ];
      expect(() => CompensationPolicy.validate(policies)).toThrow('Policy effective dates must be chronological');
    });

    it('should reject invalid date types', () => {
      const invalidPolicy = { ...validPolicy, effectiveDate: 'invalid' as any };
      expect(() => CompensationPolicy.validate([invalidPolicy])).toThrow('Effective date must be a valid date');
    });

    it('should accept single policy', () => {
      expect(() => CompensationPolicy.validate([validPolicy])).not.toThrow();
    });

    it('should accept empty policy array', () => {
      expect(() => CompensationPolicy.validate([])).not.toThrow();
    });
  });

  describe('parsing', () => {
    it('should successfully parse valid policies', () => {
      const result = CompensationPolicy.parse([
        { ...validPolicy, effectiveDate: new Date('2023-01-01') }
      ]);
      expect(result).toEqual([validPolicy]);
    });

    it('should throw on invalid input', () => {
      expect(() => CompensationPolicy.parse([{ ...validPolicy, compensation: -1 }])).toThrow('Compensation must be positive');
    });
  });
});