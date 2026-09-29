import { sanitize } from '../sanitize';

export type WithholdingType =
  | 'tax'
  | 'social_security'
  | 'pension'
  | 'health_insurance'
  | 'custom';

export interface WithholdingConfig {
  id?: string;
  withholdingType: WithholdingType;
  withholdingRate: number; // percentage, 0 to 100
  thresholdAmount: number; // minimum threshold or ceiling amount
  jurisdictionCode: string; // e.g. "US-CA", "UK-HMRC", "DE-FINANZAMT"
  effectiveDate: string; // ISO date string YYYY-MM-DD
  description?: string;
}

export interface FieldValidationError {
  field: keyof WithholdingConfig;
  message: string;
}

export interface WithholdingValidationResult {
  isValid: boolean;
  errors: FieldValidationError[];
  sanitizedConfig?: WithholdingConfig;
}

const VALID_WITHHOLDING_TYPES: WithholdingType[] = [
  'tax',
  'social_security',
  'pension',
  'health_insurance',
  'custom',
];

/**
 * Validates a withholding configuration object.
 * Guarantees that sensitive salary/PII details are never leaked in error messages.
 */
export function validateWithholdingConfig(
  input: Partial<WithholdingConfig>
): WithholdingValidationResult {
  const errors: FieldValidationError[] = [];

  // Withholding Type Validation
  if (!input.withholdingType) {
    errors.push({
      field: 'withholdingType',
      message: 'Withholding type is required.',
    });
  } else if (!VALID_WITHHOLDING_TYPES.includes(input.withholdingType)) {
    errors.push({
      field: 'withholdingType',
      message: `Invalid withholding type. Must be one of: ${VALID_WITHHOLDING_TYPES.join(', ')}.`,
    });
  }

  // Withholding Rate Validation (0% to 100%)
  if (input.withholdingRate === undefined || input.withholdingRate === null) {
    errors.push({
      field: 'withholdingRate',
      message: 'Withholding rate is required.',
    });
  } else if (typeof input.withholdingRate !== 'number' || isNaN(input.withholdingRate)) {
    errors.push({
      field: 'withholdingRate',
      message: 'Withholding rate must be a valid number.',
    });
  } else if (input.withholdingRate < 0 || input.withholdingRate > 100) {
    errors.push({
      field: 'withholdingRate',
      message: 'Withholding rate must be between 0% and 100%.',
    });
  }

  // Threshold Amount Validation (>= 0)
  if (input.thresholdAmount === undefined || input.thresholdAmount === null) {
    errors.push({
      field: 'thresholdAmount',
      message: 'Threshold amount is required.',
    });
  } else if (typeof input.thresholdAmount !== 'number' || isNaN(input.thresholdAmount)) {
    errors.push({
      field: 'thresholdAmount',
      message: 'Threshold amount must be a valid number.',
    });
  } else if (input.thresholdAmount < 0) {
    errors.push({
      field: 'thresholdAmount',
      message: 'Threshold amount cannot be negative.',
    });
  }

  // Jurisdiction Code Validation
  if (!input.jurisdictionCode || typeof input.jurisdictionCode !== 'string' || input.jurisdictionCode.trim() === '') {
    errors.push({
      field: 'jurisdictionCode',
      message: 'Jurisdiction code is required.',
    });
  } else if (input.jurisdictionCode.trim().length > 50) {
    errors.push({
      field: 'jurisdictionCode',
      message: 'Jurisdiction code cannot exceed 50 characters.',
    });
  }

  // Effective Date Validation
  if (!input.effectiveDate || typeof input.effectiveDate !== 'string' || input.effectiveDate.trim() === '') {
    errors.push({
      field: 'effectiveDate',
      message: 'Effective date is required.',
    });
  } else {
    const parsedDate = Date.parse(input.effectiveDate);
    if (isNaN(parsedDate)) {
      errors.push({
        field: 'effectiveDate',
        message: 'Effective date must be a valid date string (YYYY-MM-DD).',
      });
    }
  }

  // Ensure errors do not contain sensitive details
  const sanitizedErrors = errors.map((err) => ({
    field: err.field,
    message: sanitize(err.message),
  }));

  if (sanitizedErrors.length > 0) {
    return {
      isValid: false,
      errors: sanitizedErrors,
    };
  }

  const sanitizedConfig: WithholdingConfig = {
    id: input.id,
    withholdingType: input.withholdingType!,
    withholdingRate: input.withholdingRate!,
    thresholdAmount: input.thresholdAmount!,
    jurisdictionCode: sanitize(input.jurisdictionCode!.trim()),
    effectiveDate: input.effectiveDate!.trim(),
    description: input.description ? sanitize(input.description.trim()) : undefined,
  };

  return {
    isValid: true,
    errors: [],
    sanitizedConfig,
  };
}
