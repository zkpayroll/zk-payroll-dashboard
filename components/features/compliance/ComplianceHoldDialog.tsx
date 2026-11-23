"use client";

import { useState } from "react";
import { Loader2, ShieldAlert, X } from "lucide-react";
import { ComplianceHoldReasonSelector } from "./ComplianceHoldReasonSelector";

export interface ComplianceHoldDialogProps {
  isOpen: boolean;
  targetLabel: string;
  onClose: () => void;
  onSubmit: (payload: { reasonCode: string; notes: string }) => Promise<void>;
}

export function ComplianceHoldDialog({
  isOpen,
  targetLabel,
  onClose,
  onSubmit,
}: ComplianceHoldDialogProps) {
  const [reasonCode, setReasonCode] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reasonCode) {
      setReasonError("Please select a hold reason before submitting.");
      return;
    }
    setReasonError(null);
    setSubmitError(null);
    setIsLoading(true);

    try {
      await onSubmit({ reasonCode, notes });
      // Reset on success — caller is responsible for closing the dialog
      setReasonCode("");
      setNotes("");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to place hold. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setReasonCode("");
    setNotes("");
    setReasonError(null);
    setSubmitError(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hold-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h2
              id="hold-dialog-title"
              className="text-base font-semibold text-gray-900"
            >
              Place Compliance Hold
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close dialog"
            className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            You are placing a compliance hold on{" "}
            <span className="font-medium text-gray-900">{targetLabel}</span>.
            Select a structured reason code so this action remains auditable.
          </p>

          <ComplianceHoldReasonSelector
            id="hold-reason"
            name="holdReason"
            value={reasonCode}
            onChange={(code) => {
              setReasonCode(code);
              if (reasonError) setReasonError(null);
            }}
            disabled={isLoading}
            required
            error={reasonError}
            label="Required Hold Reason"
          />

          <div className="space-y-1.5">
            <label
              htmlFor="hold-notes"
              className="block text-sm font-medium text-gray-700"
            >
              Additional Notes{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="hold-notes"
              name="holdNotes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              placeholder="Provide any additional audit or operational context. Do not include salary amounts or personal identifiers."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed resize-none"
            />
          </div>

          {submitError && (
            <p className="text-xs text-red-600 font-medium" role="alert">
              {submitError}
            </p>
          )}

          {/* Footer actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reasonCode || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Place Hold
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ComplianceHoldDialog;
