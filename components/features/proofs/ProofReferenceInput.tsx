"use client";

import { useId, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  normalizeProofReference,
  validateProofReference,
  PROOF_REFERENCE_FORMAT_HINT,
} from "@/lib/validation/proofReference";

export interface ProofReferenceInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidityChange?: (isValid: boolean) => void;
  label?: string;
}

/**
 * Text field for entering a proof reference ID with inline format
 * validation. Pasted values are trimmed/normalized before being validated
 * so copy/paste from explorers or logs doesn't trip false negatives.
 */
export function ProofReferenceInput({
  value,
  onChange,
  onValidityChange,
  label = "Proof reference",
}: ProofReferenceInputProps) {
  const inputId = useId();
  const hintId = useId();
  const [touched, setTouched] = useState(false);

  const validation = validateProofReference(value);
  const showError = touched && value.length > 0 && !validation.isValid;

  const commit = (next: string) => {
    onChange(next);
    onValidityChange?.(validateProofReference(next).isValid);
  };

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
          onChange={(e) => commit(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text");
            commit(normalizeProofReference(pasted));
          }}
          onBlur={() => setTouched(true)}
          placeholder="zkp_ref_20250228_001"
          aria-describedby={hintId}
          aria-invalid={showError}
          className={`w-full rounded-md border px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 ${
            showError
              ? "border-red-300 focus:ring-red-500 focus:border-red-500"
              : value.length > 0 && validation.isValid
                ? "border-green-300 focus:ring-green-500 focus:border-green-500"
                : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          }`}
        />
        {value.length > 0 && validation.isValid && (
          <CheckCircle2
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500"
            aria-hidden="true"
          />
        )}
      </div>

      {showError ? (
        <p id={hintId} role="alert" className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {validation.message}
        </p>
      ) : (
        <p id={hintId} className="text-xs text-gray-400">
          {PROOF_REFERENCE_FORMAT_HINT}
        </p>
      )}
    </div>
  );
}

export default ProofReferenceInput;
