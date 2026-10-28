"use client";

import { useState } from "react";
import { AlertTriangle, Shield, X, EyeOff } from "lucide-react";
import type { Employee } from "@/types/models";
import {
  reviewCommitmentReplacement,
  COMMITMENT_CHANGE_KIND_LABELS,
} from "@/lib/employees/commitmentReplacementReview";
import { useEmployeeStore } from "@/stores/employees";

export interface CommitmentReplacementDialogProps {
  isOpen: boolean;
  employee: Employee | undefined;
  nextCommitment: string;
  nextAddress?: string;
  confirmedBy?: string;
  onCancel: () => void;
  onConfirmed: () => void;
}

/**
 * Review-before-replace confirmation gate for an employee's salary
 * commitment hash and/or wallet address (#757).
 *
 * The dialog is deliberately "dumb": all validation and diffing logic lives
 * in `reviewCommitmentReplacement`, a pure function, so the review rules can
 * be unit tested without rendering React. This component only:
 *  - shows the pure function's result,
 *  - blocks confirmation when the result is a rejection,
 *  - applies the change via `confirmCommitmentReplacement` (which also
 *    writes the audit log entry) only after an explicit operator click.
 *
 * PRIVACY: renders only truncated hash/address previews produced by the
 * review function — never the raw salary amount, never a full wallet
 * address.
 */
export function CommitmentReplacementDialog({
  isOpen,
  employee,
  nextCommitment,
  nextAddress,
  confirmedBy,
  onCancel,
  onConfirmed,
}: CommitmentReplacementDialogProps) {
  const confirmCommitmentReplacement = useEmployeeStore(
    (s) => s.confirmCommitmentReplacement,
  );
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const result = reviewCommitmentReplacement({
    employee,
    nextCommitment,
    nextAddress,
  });

  const handleConfirm = () => {
    if (!result.ok) return;
    setIsConfirming(true);
    confirmCommitmentReplacement(
      {
        employeeId: result.review.employeeId,
        changeKind: result.review.changeKind,
        previousCommitmentPreview: result.review.previousCommitmentPreview,
        nextCommitmentPreview: result.review.nextCommitmentPreview,
        confirmedBy,
      },
      {
        salaryCommitment: nextCommitment.trim(),
        ...(result.review.walletChanged && nextAddress ? { address: nextAddress } : {}),
      },
    );
    setIsConfirming(false);
    onConfirmed();
  };

  return (
    <div
      data-testid="commitment-replacement-dialog"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="commitment-replacement-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 p-6 flex items-start gap-3">
          <div className="text-amber-600 p-2 rounded-lg bg-amber-100 flex-shrink-0">
            <Shield className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="commitment-replacement-title" className="font-semibold text-lg text-amber-900">
              Confirm Commitment Replacement
            </h2>
            <p className="text-sm mt-1 text-amber-800">
              Review the change before it is applied. This will affect how
              future payroll runs verify this employee&apos;s commitment.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!result.ok ? (
            <div
              data-testid="commitment-replacement-error"
              role="alert"
              className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-800">{result.error.code}</p>
                <p className="text-sm text-red-700 mt-0.5">{result.error.message}</p>
              </div>
            </div>
          ) : (
            <div data-testid="commitment-replacement-summary" className="bg-gray-50 rounded-lg p-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Changing</span>
                <span className="font-semibold text-gray-900">
                  {COMMITMENT_CHANGE_KIND_LABELS[result.review.changeKind]}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Previous commitment</span>
                <span className="font-mono text-gray-900">
                  {result.review.previousCommitmentPreview}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">New commitment</span>
                <span className="font-mono text-gray-900">
                  {result.review.nextCommitmentPreview}
                </span>
              </div>
              {result.review.walletChanged && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Previous wallet</span>
                    <span className="font-mono text-gray-900">
                      {result.review.previousWalletPreview}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">New wallet</span>
                    <span className="font-mono text-gray-900">
                      {result.review.nextWalletPreview}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-start gap-2">
            <EyeOff className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-700">
              Raw salary amounts are never shown here. Only commitment hash
              and wallet address previews are displayed.
            </p>
          </div>
        </div>

        <div className="flex gap-3 p-4 bg-gray-50 border-t">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!result.ok || isConfirming}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isConfirming ? "Confirming…" : "Confirm Replacement"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommitmentReplacementDialog;
