"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { normalizeAssetSymbol } from "@/lib/assets/normalizeAssetSymbol";

export interface AssetSymbolInputProps {
  value: string;
  onChange: (value: string, normalized: string) => void;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  /** Whether to show validation errors inline */
  showValidation?: boolean;
}

/**
 * Asset symbol input with normalization warning.
 * When user enters a symbol that will be normalized (lowercase, spaces, trailing whitespace),
 * a small warning is shown before validation/submission so the change is transparent.
 * Privacy-safe: handles only symbol codes, never amounts or private values.
 */
export function AssetSymbolInput({
  value,
  onChange,
  label = "Asset symbol",
  placeholder = "e.g. USDC",
  id = "asset-symbol-input",
  className = "",
  showValidation = true,
}: AssetSymbolInputProps) {
  const [touched, setTouched] = useState(false);

  const result = useMemo(() => normalizeAssetSymbol(value), [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const { normalized } = normalizeAssetSymbol(raw);
    onChange(raw, normalized);
    if (!touched) setTouched(true);
  };

  const showWarning = touched && result.wasNormalized && result.normalized.length > 0;
  const showError = touched && showValidation && !result.isValid;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        aria-describedby={`${id}-warning ${id}-error`}
        aria-invalid={showError ? "true" : "false"}
        className={`w-full rounded-md border px-3 py-2 text-sm font-mono focus:ring-2 focus:outline-none ${
          showError
            ? "border-red-300 focus:ring-red-500 focus:border-red-500"
            : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
        }`}
        data-testid="asset-symbol-input"
      />

      {showWarning && result.warningMessage && (
        <div
          id={`${id}-warning`}
          role="alert"
          data-testid="asset-symbol-warning"
          className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800"
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{result.warningMessage}</span>
        </div>
      )}

      {showError && result.validationError ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {result.validationError}
        </p>
      ) : null}

      {!showWarning && !showError && touched && result.normalized && result.isValid && (
        <p className="mt-1 flex items-center gap-1 text-xs text-green-600" data-testid="asset-symbol-valid">
          <Check className="w-3 h-3" />
          Will be submitted as <span className="font-mono font-medium">{result.normalized}</span>
        </p>
      )}

      <p className="mt-1 text-xs text-gray-500">
        Symbol is normalized to uppercase without spaces for consistency before validation.
      </p>
    </div>
  );
}

export function AssetSymbolWarning({
  raw,
  className = "",
}: {
  raw: string;
  className?: string;
}) {
  const result = normalizeAssetSymbol(raw);
  if (!result.wasNormalized) return null;
  return (
    <div
      data-testid="asset-symbol-warning"
      role="status"
      aria-label="Asset symbol normalized"
      className={`flex items-start gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800 ${className}`}
    >
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>{result.warningMessage}</span>
    </div>
  );
}

export default AssetSymbolInput;
