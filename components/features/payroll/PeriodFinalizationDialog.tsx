"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertOctagon, Lock, ShieldCheck, FileCheck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PeriodFinalizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  periodId: string;
  employeeCount?: number;
  totalAmount?: number;
  isSubmitting?: boolean;
  title?: string;
}

export function PeriodFinalizationDialog({
  isOpen,
  onClose,
  onConfirm,
  periodId,
  employeeCount,
  totalAmount,
  isSubmitting = false,
  title = "Finalize & Close Payroll Period",
}: PeriodFinalizationDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAcknowledged(false);
      setError(null);
      // Safe focus default on Cancel button
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

  const handleConfirm = async () => {
    if (!acknowledged) {
      setError("You must acknowledge the immutability warning before finalizing.");
      return;
    }
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finalize payroll period.");
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="period-finalization-title"
      aria-describedby="period-finalization-desc"
      data-testid="period-finalization-dialog"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-2xl transition-all">
        {/* Header with High-Impact Warning Icon */}
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertOctagon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2
              id="period-finalization-title"
              className="text-base font-semibold text-gray-900"
            >
              {title}
            </h2>
            <p
              id="period-finalization-desc"
              className="text-xs sm:text-sm text-gray-600"
            >
              You are about to permanently finalize period{" "}
              <span className="font-semibold text-gray-900 font-mono">{periodId}</span>.
              This action creates an irreversible cryptographic seal and locks the period from further edits.
            </p>
          </div>
        </div>

        {/* Period Details Summary */}
        {(employeeCount !== undefined || totalAmount !== undefined) && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-xs text-gray-700">
            {employeeCount !== undefined && (
              <div>
                <span className="text-gray-500">Employees: </span>
                <span className="font-semibold text-gray-900">{employeeCount}</span>
              </div>
            )}
            {totalAmount !== undefined && (
              <div>
                <span className="text-gray-500">Total Disbursement: </span>
                <span className="font-semibold text-gray-900">
                  ${totalAmount.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Downstream Impacts Notice */}
        <div className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950">
          <h3 className="font-semibold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Downstream Impacts & Immutability
          </h3>
          <ul className="space-y-1.5 list-disc pl-4 text-amber-900/90">
            <li>
              <strong>Permanent Record Locking:</strong> Transaction batches cannot be modified, re-ordered, or deleted after finalization.
            </li>
            <li>
              <strong>Funding Settlement:</strong> All temporary funding reservations will be settled permanently against treasury vaults.
            </li>
            <li>
              <strong>Compliance Audit Seal:</strong> The audit timeline and zero-knowledge batch roots are committed to immutable compliance storage.
            </li>
            <li>
              <strong>Corrections:</strong> Any future payroll adjustments must be issued via an off-cycle supplementary batch.
            </li>
          </ul>
        </div>

        {/* Confirmation Checkbox */}
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50/50 p-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              id="acknowledge-finalization-checkbox"
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              aria-describedby="acknowledge-finalization-desc"
            />
            <span
              id="acknowledge-finalization-desc"
              className="text-xs font-medium text-red-950"
            >
              I understand that closing this period is permanent and irreversible.
            </span>
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            <AlertOctagon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
          >
            Cancel and keep open
          </button>

          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!acknowledged || isSubmitting}
            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Finalizing..." : "Confirm & finalize period"}
          </button>
        </div>
      </div>
    </div>
  );
}
