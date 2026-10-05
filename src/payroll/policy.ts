import { z } from 'zod';
import { PayrollPolicy } from '../types';

const PolicyDateSchema = z.object({
  effectiveDate: z.date({
    required_error: 'Effective date is required',
    invalid_type_error: 'Effective date must be a valid date'
  })
});

const PolicySchema = z.object({
  id: z.string(),
  effectiveDate: PolicyDateSchema.shape.effectiveDate,
  compensation: z.number().positive('Compensation must be positive'),
  currency: z.string().min(3, 'Currency must be at least 3 characters')
});

export class CompensationPolicy {
  private static validatePolicies(policies: PayrollPolicy[]): void {
    if (policies.length === 0) return;

    const sorted = [...policies].sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      if (current.effectiveDate >= next.effectiveDate) {
        throw new Error(`Policy effective dates must be chronological. Found ${current.effectiveDate} followed by ${next.effectiveDate}`);
      }
    }
  }

  static validate(policies: PayrollPolicy[]): void {
    PolicySchema.array().parse(policies);
    this.validatePolicies(policies);
  }

  static parse(policies: unknown): PayrollPolicy[] {
    return PolicySchema.array().parse(policies);
  }
}