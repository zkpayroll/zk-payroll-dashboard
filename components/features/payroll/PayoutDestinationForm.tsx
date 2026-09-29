"use client";

import { useState, useCallback, useId } from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import {
  validatePayoutDestination,
  validatePayoutDestinations,
  isPayoutDestinationValid,
  ALLOWED_ASSET_CODES,
} from "@/lib/validation/payoutDestination";
import type {
  PayoutDestinationInput,
  PayoutDestinationErrors,
} from "@/lib/validation/payoutDestination";

// ─── Field error message ──────────────────────────────────────────────────────

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1 flex items-center gap-1 text-xs text-red-600"
    >
      <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

// ─── Single destination row ───────────────────────────────────────────────────

interface DestinationRowProps {
  index: number;
  value: PayoutDestinationInput;
  errors: PayoutDestinationErrors;
  onChange: (index: number, field: keyof PayoutDestinationInput, value: string) => void;
}

function DestinationRow({ index, value, errors, onChange }: DestinationRowProps) {
  const uid = useId();
  const empId = `${uid}-empId`;
  const walletId = `${uid}-wallet`;
  const assetId = `${uid}-asset`;

  return (
    <div
      className="rounded-md border border-gray-200 p-4 space-y-3 bg-white"
      role="group"
      aria-label={`Payout destination ${index + 1}`}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Destination {index + 1}
      </p>

      {/* Employee ID */}
      <div>
        <label htmlFor={empId} className="block text-xs font-medium text-gray-700 mb-1">
          Employee ID <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id={empId}
          type="text"
          value={value.employeeId}
          onChange={(e) => onChange(index, "employeeId", e.target.value)}
          aria-invalid={!!errors.employeeId}
          aria-describedby={errors.employeeId ? `${empId}-error` : undefined}
          placeholder="emp_001"
          className={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            errors.employeeId
              ? "border-red-400 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
          }`}
        />
        <FieldError id={`${empId}-error`} message={errors.employeeId} />
      </div>

      {/* Wallet address */}
      <div>
        <label htmlFor={walletId} className="block text-xs font-medium text-gray-700 mb-1">
          Stellar Wallet Address <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id={walletId}
          type="text"
          value={value.walletAddress}
          onChange={(e) => onChange(index, "walletAddress", e.target.value)}
          aria-invalid={!!errors.walletAddress}
          aria-describedby={errors.walletAddress ? `${walletId}-error` : `${walletId}-hint`}
          placeholder="GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
          spellCheck={false}
          autoComplete="off"
          maxLength={56}
          className={`block w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 ${
            errors.walletAddress
              ? "border-red-400 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
          }`}
        />
        {!errors.walletAddress && (
          <p id={`${walletId}-hint`} className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
            Must start with G and be exactly 56 characters.
          </p>
        )}
        <FieldError id={`${walletId}-error`} message={errors.walletAddress} />
      </div>

      {/* Asset code */}
      <div>
        <label htmlFor={assetId} className="block text-xs font-medium text-gray-700 mb-1">
          Asset Code <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <select
          id={assetId}
          value={value.assetCode}
          onChange={(e) => onChange(index, "assetCode", e.target.value)}
          aria-invalid={!!errors.assetCode}
          aria-describedby={errors.assetCode ? `${assetId}-error` : undefined}
          className={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            errors.assetCode
              ? "border-red-400 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
          }`}
        >
          <option value="">Select asset…</option>
          {ALLOWED_ASSET_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <FieldError id={`${assetId}-error`} message={errors.assetCode} />
      </div>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface PayoutDestinationFormProps {
  /**
   * Initial destinations to populate the form.  Defaults to one empty row.
   */
  initialDestinations?: PayoutDestinationInput[];
  /**
   * Called when the form is submitted with all-valid destinations.
   * Receives a validated copy of the destinations array.
   */
  onSubmit: (destinations: PayoutDestinationInput[]) => void;
}

const emptyRow = (): PayoutDestinationInput => ({
  employeeId: "",
  walletAddress: "",
  assetCode: "",
});

/**
 * Client-side form for entering payout destinations with inline validation.
 *
 * Validation is run:
 * 1. Per-field on blur (to catch errors as the user leaves a field).
 * 2. Across the full batch on submit (to catch duplicate addresses etc.).
 *
 * Accessibility:
 * - Each field pair uses `aria-invalid` + `aria-describedby` to link its
 *   error message.
 * - Error messages use `role="alert"` so screen readers announce them
 *   immediately when they appear.
 * - The submit button's `aria-describedby` references the summary error when
 *   the form is invalid.
 */
export function PayoutDestinationForm({
  initialDestinations,
  onSubmit,
}: PayoutDestinationFormProps) {
  const [rows, setRows] = useState<PayoutDestinationInput[]>(
    initialDestinations?.length ? initialDestinations : [emptyRow()],
  );

  // Per-row errors, keyed by row index
  const [rowErrors, setRowErrors] = useState<
    Record<number, PayoutDestinationErrors>
  >({});

  // Duplicate address warning (batch-level)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const summaryId = useId();

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (index: number, field: keyof PayoutDestinationInput, value: string) => {
      setRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });

      // Live-validate this row whenever a field changes
      setRowErrors((prev) => {
        const updatedRow = { ...rows[index], [field]: value };
        const errs = validatePayoutDestination(updatedRow);
        const next = { ...prev };
        if (isPayoutDestinationValid(errs)) {
          delete next[index];
        } else {
          next[index] = errs;
        }
        return next;
      });
    },
    [rows],
  );

  const handleBlur = useCallback(
    (index: number) => {
      const errs = validatePayoutDestination(rows[index]);
      setRowErrors((prev) => {
        const next = { ...prev };
        if (isPayoutDestinationValid(errs)) {
          delete next[index];
        } else {
          next[index] = errs;
        }
        return next;
      });
    },
    [rows],
  );

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setRowErrors((prev) => {
      const next: Record<number, PayoutDestinationErrors> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    const result = validatePayoutDestinations(rows);
    setRowErrors(result.rowErrors);

    if (result.duplicateAddresses.length > 0) {
      setDuplicateWarning(
        `Duplicate wallet address detected: ${result.duplicateAddresses[0]}. Each employee must have a unique destination address.`,
      );
    } else {
      setDuplicateWarning(null);
    }

    if (!result.isValid) return;

    onSubmit(rows);
  };

  const hasErrors = Object.keys(rowErrors).length > 0 || !!duplicateWarning;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Payout destination configuration"
    >
      <div className="space-y-4">
        {/* Batch-level duplicate warning */}
        {duplicateWarning && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
          >
            <AlertTriangle
              className="h-4 w-4 text-amber-600 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm text-amber-800">{duplicateWarning}</p>
          </div>
        )}

        {/* Destination rows */}
        {rows.map((row, idx) => (
          <div key={idx} onBlur={() => handleBlur(idx)}>
            <DestinationRow
              index={idx}
              value={row}
              errors={rowErrors[idx] ?? {}}
              onChange={handleChange}
            />
            {rows.length > 1 && (
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="text-xs text-red-500 hover:text-red-700 underline"
                  aria-label={`Remove destination ${idx + 1}`}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add row */}
        <button
          type="button"
          onClick={addRow}
          className="w-full rounded-md border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          + Add destination
        </button>

        {/* Submit summary error */}
        {submitted && hasErrors && (
          <p
            id={summaryId}
            role="alert"
            className="flex items-center gap-1.5 text-sm text-red-600"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            One or more destinations have errors. Please correct them before
            submitting.
          </p>
        )}

        {/* Success indicator */}
        {submitted && !hasErrors && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-sm text-green-700"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            All destinations are valid.
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          aria-describedby={submitted && hasErrors ? summaryId : undefined}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          Confirm Destinations
        </button>
      </div>
    </form>
  );
}
