'use client';

import React, { useState } from 'react';
import {
  validateWithholdingConfig,
  WithholdingConfig,
  WithholdingType,
} from '@/lib/validation/withholdingConfig';

interface WithholdingConfigFormProps {
  initialValues?: Partial<WithholdingConfig>;
  onSubmitSuccess?: (config: WithholdingConfig) => void;
  onCancel?: () => void;
}

export const WithholdingConfigForm: React.FC<WithholdingConfigFormProps> = ({
  initialValues,
  onSubmitSuccess,
  onCancel,
}) => {
  const [withholdingType, setWithholdingType] = useState<WithholdingType>(
    initialValues?.withholdingType || 'tax'
  );
  const [withholdingRate, setWithholdingRate] = useState<string>(
    initialValues?.withholdingRate !== undefined ? String(initialValues.withholdingRate) : '0'
  );
  const [thresholdAmount, setThresholdAmount] = useState<string>(
    initialValues?.thresholdAmount !== undefined ? String(initialValues.thresholdAmount) : '0'
  );
  const [jurisdictionCode, setJurisdictionCode] = useState<string>(
    initialValues?.jurisdictionCode || ''
  );
  const [effectiveDate, setEffectiveDate] = useState<string>(
    initialValues?.effectiveDate || new Date().toISOString().split('T')[0]
  );
  const [description, setDescription] = useState<string>(
    initialValues?.description || ''
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const configToValidate: Partial<WithholdingConfig> = {
      withholdingType,
      withholdingRate: Number(withholdingRate),
      thresholdAmount: Number(thresholdAmount),
      jurisdictionCode,
      effectiveDate,
      description,
    };

    const result = validateWithholdingConfig(configToValidate);

    if (!result.isValid) {
      const errorMap: Record<string, string> = {};
      result.errors.forEach((err) => {
        errorMap[err.field] = err.message;
      });
      setErrors(errorMap);
      return;
    }

    setErrors({});
    setIsSubmitted(true);
    if (result.sanitizedConfig && onSubmitSuccess) {
      onSubmitSuccess(result.sanitizedConfig);
    }
  };

  return (
    <div className="bg-card text-card-foreground p-6 rounded-lg border shadow-sm max-w-xl">
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-tight">Withholding Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure tax and regulatory withholding rates. Operational rules apply without exposing employee salary details.
        </p>
      </div>

      {isSubmitted && (
        <div
          role="status"
          className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-300 rounded text-sm"
        >
          Withholding configuration validated and saved successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="withholdingType" className="block text-sm font-medium mb-1">
            Withholding Category
          </label>
          <select
            id="withholdingType"
            value={withholdingType}
            onChange={(e) => setWithholdingType(e.target.value as WithholdingType)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="tax">Tax</option>
            <option value="social_security">Social Security</option>
            <option value="pension">Pension</option>
            <option value="health_insurance">Health Insurance</option>
            <option value="custom">Custom Statutory</option>
          </select>
          {errors.withholdingType && (
            <p role="alert" id="withholdingType-error" className="text-xs text-destructive mt-1">
              {errors.withholdingType}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="withholdingRate" className="block text-sm font-medium mb-1">
              Withholding Rate (%)
            </label>
            <input
              id="withholdingRate"
              type="number"
              step="0.01"
              value={withholdingRate}
              onChange={(e) => setWithholdingRate(e.target.value)}
              aria-invalid={!!errors.withholdingRate}
              aria-describedby={errors.withholdingRate ? 'withholdingRate-error' : undefined}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.withholdingRate && (
              <p role="alert" id="withholdingRate-error" className="text-xs text-destructive mt-1">
                {errors.withholdingRate}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="thresholdAmount" className="block text-sm font-medium mb-1">
              Threshold Amount
            </label>
            <input
              id="thresholdAmount"
              type="number"
              step="1"
              value={thresholdAmount}
              onChange={(e) => setThresholdAmount(e.target.value)}
              aria-invalid={!!errors.thresholdAmount}
              aria-describedby={errors.thresholdAmount ? 'thresholdAmount-error' : undefined}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.thresholdAmount && (
              <p role="alert" id="thresholdAmount-error" className="text-xs text-destructive mt-1">
                {errors.thresholdAmount}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="jurisdictionCode" className="block text-sm font-medium mb-1">
            Jurisdiction / Authority Code
          </label>
          <input
            id="jurisdictionCode"
            type="text"
            placeholder="e.g. US-CA or UK-HMRC"
            value={jurisdictionCode}
            onChange={(e) => setJurisdictionCode(e.target.value)}
            aria-invalid={!!errors.jurisdictionCode}
            aria-describedby={errors.jurisdictionCode ? 'jurisdictionCode-error' : undefined}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {errors.jurisdictionCode && (
            <p role="alert" id="jurisdictionCode-error" className="text-xs text-destructive mt-1">
              {errors.jurisdictionCode}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="effectiveDate" className="block text-sm font-medium mb-1">
            Effective Date
          </label>
          <input
            id="effectiveDate"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            aria-invalid={!!errors.effectiveDate}
            aria-describedby={errors.effectiveDate ? 'effectiveDate-error' : undefined}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {errors.effectiveDate && (
            <p role="alert" id="effectiveDate-error" className="text-xs text-destructive mt-1">
              {errors.effectiveDate}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Notes / Description (Optional)
          </label>
          <textarea
            id="description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="pt-2 flex justify-end space-x-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Save Withholding Config
          </button>
        </div>
      </form>
    </div>
  );
};
