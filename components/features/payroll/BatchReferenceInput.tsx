"use client";

import { useId, useState, useMemo } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import {
  validateBatchReferenceWithDuplicateCheck,
  normalizeBatchReference,
  BATCH_REFERENCE_FORMAT_HINT,
} from "@/lib/validation/batchReference";

export interface BatchReferenceInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  label?: string;
  placeholder?: string;
  hint?: string;
  existingReferences?: string[];
  autoFocus?: boolean;
  id?: string;
}

/**
 * Text field for an external payroll batch reference with inline validation
 * and helper copy. Prevents duplicate or malformed identifiers and surfaces
 * actionable guidance.
 *
 * Privacy-safe: handles only the reference string; never payroll amounts.
 */
export function BatchReferenceInput({
  value,
  onChange,
  onValidityChange,
  label = "External batch reference",
  placeholder = "e.g. BATCH-2025-001",
  hint,
  existingReferences = [],
  autoFocus,
  id,
}: BatchReferenceInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [touched, setTouched] = useState(false);

  const validation = useMemo(
    () => validateBatchReferenceWithDuplicateCheck(value, existingReferences),
    [value, existingReferences],
  );

  const showError = touched && value.length > 0 && !validation.isValid;
  const showValid = touched && value.length > 0 && validation.isValid;

  const commit = (next: string) => {
    onChange(next);
    onValidityChange?.(validateBatchReferenceWithDuplicateCheck(next, existingReferences).isValid);
  };

  const helperCopy = hint ?? BATCH_REFERENCE_FORMAT_HINT;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={value}
          autoFocus={autoFocus} // eslint-disable-line jsx-a11y/no-autofocus
          onChange={(e) => commit(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text");
            commit(normalizeBatchReference(pasted));
          }}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          aria-describedby={`${hintId} ${showError ? errorId : ""}`}
          aria-invalid={showError}
          maxLength={32}
          className={`w-full rounded-md border px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 ${
            showError
              ? "border-red-300 focus:ring-red-500 focus:border-red-500"
              : showValid
                ? "border-green-300 focus:ring-green-500 focus:border-green-500"
                : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          }`}
          data-testid="batch-reference-input"
        />
        {showValid && (
          <CheckCircle2
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500"
            aria-hidden="true"
          />
        )}
      </div>

      {showError ? (
        <p id={errorId} role="alert" data-testid="batch-reference-error" className="flex items-start gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{validation.message}</span>
        </p>
      ) : (
        <p id={hintId} data-testid="batch-reference-hint" className="flex items-start gap-1 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{helperCopy}</span>
        </p>
      )}

      {showValid && (
        <p className="text-xs text-green-600" data-testid="batch-reference-valid">
          Will be submitted as <span className="font-mono font-medium">{validation.normalized}</span>
        </p>
      )}
    </div>
  );
}

export default BatchReferenceInput;
