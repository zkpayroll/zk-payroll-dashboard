import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { validateWithholdingConfig } from '@/lib/validation/withholdingConfig';
import { WithholdingConfigForm } from '@/components/features/payroll/WithholdingConfigForm';

describe('validateWithholdingConfig', () => {
  it('passes validation with a valid withholding configuration', () => {
    const result = validateWithholdingConfig({
      withholdingType: 'tax',
      withholdingRate: 15,
      thresholdAmount: 1000,
      jurisdictionCode: 'US-CA',
      effectiveDate: '2026-10-01',
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitizedConfig?.jurisdictionCode).toBe('US-CA');
  });

  it('rejects withholding rate below 0% or above 100%', () => {
    const resultLow = validateWithholdingConfig({
      withholdingType: 'tax',
      withholdingRate: -5,
      thresholdAmount: 500,
      jurisdictionCode: 'US-CA',
      effectiveDate: '2026-10-01',
    });

    expect(resultLow.isValid).toBe(false);
    expect(resultLow.errors).toContainEqual({
      field: 'withholdingRate',
      message: 'Withholding rate must be between 0% and 100%.',
    });

    const resultHigh = validateWithholdingConfig({
      withholdingType: 'tax',
      withholdingRate: 105,
      thresholdAmount: 500,
      jurisdictionCode: 'US-CA',
      effectiveDate: '2026-10-01',
    });

    expect(resultHigh.isValid).toBe(false);
    expect(resultHigh.errors).toContainEqual({
      field: 'withholdingRate',
      message: 'Withholding rate must be between 0% and 100%.',
    });
  });

  it('rejects negative threshold amounts', () => {
    const result = validateWithholdingConfig({
      withholdingType: 'pension',
      withholdingRate: 5,
      thresholdAmount: -100,
      jurisdictionCode: 'UK-HMRC',
      effectiveDate: '2026-10-01',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual({
      field: 'thresholdAmount',
      message: 'Threshold amount cannot be negative.',
    });
  });

  it('rejects missing jurisdiction code', () => {
    const result = validateWithholdingConfig({
      withholdingType: 'social_security',
      withholdingRate: 6.2,
      thresholdAmount: 0,
      jurisdictionCode: '   ',
      effectiveDate: '2026-10-01',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual({
      field: 'jurisdictionCode',
      message: 'Jurisdiction code is required.',
    });
  });

  it('does not expose sensitive employee salary values in errors', () => {
    const result = validateWithholdingConfig({
      withholdingType: 'tax',
      withholdingRate: -1,
      thresholdAmount: 0,
      jurisdictionCode: 'US-NY',
      effectiveDate: '2026-10-01',
    });

    result.errors.forEach((err) => {
      expect(err.message).not.toMatch(/salary/i);
      expect(err.message).not.toMatch(/ssn/i);
      expect(err.message).not.toMatch(/employee_name/i);
    });
  });
});

describe('WithholdingConfigForm Component', () => {
  it('renders form fields correctly', () => {
    render(<WithholdingConfigForm />);
    expect(screen.getByText('Withholding Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText(/withholding category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/withholding rate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/threshold amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/jurisdiction/i)).toBeInTheDocument();
  });

  it('shows error messages when submitting invalid form values', () => {
    render(<WithholdingConfigForm initialValues={{ withholdingRate: 150, jurisdictionCode: '' }} />);

    fireEvent.click(screen.getByText('Save Withholding Config'));

    expect(screen.getByText('Withholding rate must be between 0% and 100%.')).toBeInTheDocument();
    expect(screen.getByText('Jurisdiction code is required.')).toBeInTheDocument();
  });

  it('triggers onSubmitSuccess with sanitized data when valid', () => {
    const handleSuccess = vi.fn();
    render(
      <WithholdingConfigForm
        initialValues={{
          withholdingType: 'tax',
          withholdingRate: 20,
          thresholdAmount: 1000,
          jurisdictionCode: 'US-FED',
          effectiveDate: '2026-10-01',
        }}
        onSubmitSuccess={handleSuccess}
      />
    );

    fireEvent.click(screen.getByText('Save Withholding Config'));

    expect(handleSuccess).toHaveBeenCalledTimes(1);
    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        withholdingType: 'tax',
        withholdingRate: 20,
        thresholdAmount: 1000,
        jurisdictionCode: 'US-FED',
      })
    );
  });
});
