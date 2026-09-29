"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Unlock, ShieldAlert, Scale } from "lucide-react";

export interface PeriodReopenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  periodId: string;
  employeeCount?: number;
  isSubmitting?: boolean;
  title?: string;
}

export function PeriodReopenDialog({
  isOpen,
  onClose,
  onConfirm,
  periodId,
  employeeCount,
  isSubmitting = false,
  title = "Reopen Closed Payroll Period",
}: PeriodReopenDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAcknowledged(false);
      setReason("");
      setError(null);
      setTimeout(() => {
        cancelRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const trimmedReason = reason.trim();
  const reasonTooShort = trimmedReason.length < 10;
  const reasonTooLong = trimmedReason.length > 500;
  const canSubmit = acknowledged && !reasonTooShort && !reasonTooLong && !isSubmitting;

  const handleConfirm = async () => {
    if (!acknowledged) {
      setError("You must acknowledge the risks before reopening.");
      return;
    }
    if (reasonTooShort) {
      setError("Please provide a reason with at least 10 characters.");
      return;
    }
    if (reasonTooLong) {
      setError("Reason must be 500 characters or fewer.");
      return;
    }
    setError(null);
    try {
      await onConfirm(trimmedReason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen payroll period.");
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="period-reopen-title"
      aria-describedby="period-reopen-desc"
      data-testid="period-reopen-dialog"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl transition-all">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2
              id="period-reopen-title"
              className="text-base font-semibold text-gray-900"
            >
              {title}
            </h2>
            <p
              id="period-reopen-desc"
              className="text-xs sm:text-sm text-gray-600"
            >
              You are about to reopen period{" "}
              <span className="font-semibold text-gray-900 font-mono">{periodId}</span>.
              This breaks the existing cryptographic seal and allows edits to a previously finalized period.
            </p>
          </div>
        </div>

        {employeeCount !== undefined && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-xs text-gray-700">
            <div>
              <span className="text-gray-500">Employees affected: </span>
              <span className="font-semibold text-gray-900">{employeeCount}</span>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950">
          <h3 className="font-semibold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
            <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
            Operational Risks
          </h3>
          <ul className="space-y-1.5 list-disc pl-4 text-amber-900/90">
            <li>
              <strong>Seal Integrity:</strong> The existing audit seal is invalidated; a new seal must be generated after changes.
            </li>
            <li>
              <strong>Reconciliation Reset:</strong> Funding reservations and dispute resolutions may need to be re-verified.
            </li>
            <li>
              <strong>Audit Trail:</strong> This action will be logged with your user ID and the reason below for compliance review.
            </li>
          </ul>
        </div>

        <div className="mt-4 space-y-2">
          <label
            htmlFor="reopen-reason"
            className="block text-xs font-semibold text-gray-700"
          >
            Reopen reason <span className="text-red-600">*</span>
          </label>
          <textarea
            id="reopen-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            rows={3}
            maxLength={600}
            placeholder="e.g. Missing employee adjustment discovered during post-close review; requires supplementary batch correction."
            aria-invalid={reasonTooShort || reasonTooLong}
            aria-describedby="reopen-reason-help"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:bg-gray-50 disabled:text-gray-500"
          />
          <p
            id="reopen-reason-help"
            className={`text-[11px] ${
              reasonTooShort || reasonTooLong ? "text-red-600" : "text-gray-500"
            }`}
          >
            {trimmedReason.length}/500 characters — minimum 10.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              id="acknowledge-reopen-checkbox"
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              aria-describedby="acknowledge-reopen-desc"
              disabled={isSubmitting}
            />
            <span
              id="acknowledge-reopen-desc"
              className="text-xs font-medium text-amber-950"
            >
              I understand that reopening breaks the period seal and will be logged in the audit trail.
            </span>
          </label>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
          >
            Keep period closed
          </button>

          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canSubmit}
            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Scale className="h-4 w-4 animate-pulse" aria-hidden="true" />
                Reopening...
              </>
            ) : (
              "Confirm reopen"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
