"use client";

import React from "react";
import { AlertCircle, HelpCircle, Loader2 } from "lucide-react";
import {
  SUPPORTED_CANCELLATION_REASONS,
  getCancellationReason,
  CancellationReasonCode,
} from "@/lib/constants/cancellationReasons";

export interface CancellationReasonSelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  required?: boolean;
  error?: string | null;
  className?: string;
  label?: string;
  placeholder?: string;
  showHelperText?: boolean;
}

export function CancellationReasonSelect({
  id = "cancellation-reason-select",
  name = "cancellationReason",
  value,
  onChange,
  disabled = false,
  isLoading = false,
  required = true,
  error = null,
  className = "",
  label = "Cancellation Reason",
  placeholder = "Select a cancellation reason...",
  showHelperText = true,
}: CancellationReasonSelectProps) {
  const selectedReason = getCancellationReason(value);
  const isDisabled = disabled || isLoading;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
        {isLoading && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading options...
          </span>
        )}
      </div>

      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={handleChange}
          disabled={isDisabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error
              ? `${id}-error`
              : selectedReason && showHelperText
              ? `${id}-helper`
              : undefined
          }
          className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed ${
            error
              ? "border-red-300 focus:ring-red-500"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {SUPPORTED_CANCELLATION_REASONS.map((reason) => (
            <option key={reason.code} value={reason.code}>
              {reason.label} ({reason.code})
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div id={`${id}-error`} className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : selectedReason && showHelperText ? (
        <div
          id={`${id}-helper`}
          className="bg-gray-50 border border-gray-200 rounded-md p-2 flex items-start gap-2 text-xs text-gray-600"
        >
          <HelpCircle className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold text-gray-800">{selectedReason.label}: </span>
            <span>{selectedReason.helperText}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CancellationReasonSelect;
