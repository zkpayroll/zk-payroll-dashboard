"use client";

import { useId, useState, useMemo } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import {
  validateDraftDescription,
  DESCRIPTION_HINT,
} from "@/lib/validation/draftDescription";

export interface DraftDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  label?: string;
  placeholder?: string;
  id?: string;
}

/**
 * Text area for an optional payroll draft description with inline validation
 * and helper copy. Protects against PII and enforces length limits.
 */
export function DraftDescriptionInput({
  value,
  onChange,
  onValidityChange,
  label = "Draft Description (Optional)",
  placeholder = "e.g. Q1 Bonus Run for Engineering",
  id,
}: DraftDescriptionInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => validateDraftDescription(value), [value]);

  const showError = touched && !validation.isValid;
  const showValid = touched && value.length > 0 && validation.isValid;

  const commit = (next: string) => {
    onChange(next);
    onValidityChange?.(validateDraftDescription(next).isValid);
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <textarea
          id={inputId}
          value={value}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          aria-describedby={`${hintId} ${showError ? errorId : ""}`}
          aria-invalid={showError}
          rows={3}
          maxLength={255}
          className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 resize-none ${
            showError
              ? "border-red-300 focus:ring-red-500 focus:border-red-500"
              : showValid
                ? "border-green-300 focus:ring-green-500 focus:border-green-500"
                : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          }`}
          data-testid="draft-description-input"
        />
        {showValid && (
          <CheckCircle2
            className="absolute right-2.5 top-3 w-4 h-4 text-green-500"
            aria-hidden="true"
          />
        )}
      </div>

      {showError ? (
        <p id={errorId} role="alert" data-testid="draft-description-error" className="flex items-start gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{validation.message}</span>
        </p>
      ) : (
        <p id={hintId} data-testid="draft-description-hint" className="flex items-start gap-1 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{DESCRIPTION_HINT}</span>
        </p>
      )}
    </div>
  );
}

export default DraftDescriptionInput;
