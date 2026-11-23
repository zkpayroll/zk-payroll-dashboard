"use client";

import { useState } from "react";
import { RotateCcw, AlertTriangle, X, EyeOff, CheckCircle2 } from "lucide-react";
import type { Employee } from "@/types/models";
import {
  reviewCommitmentVersionRecovery,
  type SalaryCommitmentVersion,
} from "@/lib/employees/salaryCommitmentVersionRecovery";
import { useEmployeeStore } from "@/stores/employees";

export interface CommitmentVersionRecoveryDialogProps {
  isOpen: boolean;
  employee: Employee | undefined;
  targetVersion: SalaryCommitmentVersion | null;
  versionHistory: SalaryCommitmentVersion[];
  confirmedBy?: string;
  onCancel: () => void;
  onConfirmed: () => void;
}

/**
 * Review-before-recover confirmation dialog for salary commitment versions (#900, #962).
 *
 * Allows an operator to safely roll back or recover an earlier commitment version.
 * All decision logic runs through the pure `reviewCommitmentVersionRecovery` evaluator.
 *
 * PRIVACY GUARANTEES:
 * - Only truncated hash and address previews are displayed.
 * - Raw salary numbers and private inputs are never exposed anywhere in the UI.
 */
export function CommitmentVersionRecoveryDialog({
  isOpen,
  employee,
  targetVersion,
  versionHistory,
  confirmedBy,
  onCancel,
  onConfirmed,
}: CommitmentVersionRecoveryDialogProps) {
  const recoverCommitmentVersion = useEmployeeStore((s) => s.recoverCommitmentVersion);
  const [isRecovering, setIsRecovering] = useState(false);

  if (!isOpen || !targetVersion) return null;

  const result = reviewCommitmentVersionRecovery({
    employee,
    targetVersion: targetVersion.version,
    versionHistory,
    confirmedBy,
  });

  const handleConfirm = () => {
    if (!result.ok || !employee) return;
    setIsRecovering(true);
    const recoverResult = recoverCommitmentVersion(
      employee.id,
      targetVersion.version,
      confirmedBy,
    );
    setIsRecovering(false);
    if (recoverResult.ok) {
      onConfirmed();
    }
  };

  return (
    <div
      data-testid="commitment-version-recovery-dialog"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="commitment-recovery-title"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 p-6 flex items-start gap-3">
          <div className="text-amber-600 p-2 rounded-lg bg-amber-100 flex-shrink-0">
            <RotateCcw className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="commitment-recovery-title" className="font-semibold text-lg text-amber-900">
              Recover Salary Commitment Version
            </h2>
            <p className="text-sm mt-1 text-amber-800">
              Restore a previous commitment version for zero-knowledge payroll verification.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isRecovering}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close recovery dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!result.ok ? (
            <div
              data-testid="commitment-recovery-error"
              role="alert"
              className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-800">{result.error.code}</p>
                <p className="text-sm text-red-700 mt-0.5">{result.error.message}</p>
                {result.error.suggestedAction && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    Suggested action: {result.error.suggestedAction}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div
              data-testid="commitment-recovery-summary"
              className="bg-gray-50 rounded-lg p-4 space-y-3 text-xs border border-gray-100"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span className="text-gray-600 font-medium">Target Version to Restore</span>
                <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  v{result.review.targetVersion} (Superseded)
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span className="text-gray-600 font-medium">New Version After Recovery</span>
                <span className="font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                  v{result.review.nextVersion} (Restored from v{result.review.targetVersion})
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Current active commitment</span>
                <span className="font-mono text-gray-800">
                  {result.review.currentCommitmentPreview}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Restored commitment</span>
                <span className="font-mono text-gray-900 font-semibold">
                  {result.review.recoveredCommitmentPreview}
                </span>
              </div>

              {result.review.walletChanged && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Current wallet</span>
                    <span className="font-mono text-gray-800">
                      {result.review.previousWalletPreview}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Restored wallet</span>
                    <span className="font-mono text-gray-900 font-semibold">
                      {result.review.recoveredWalletPreview}
                    </span>
                  </div>
                </>
              )}

              <div className="mt-2 pt-2 border-t border-gray-200 text-gray-600 leading-relaxed text-xxs">
                <div className="flex items-start gap-1.5 text-gray-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                  <span>{result.review.recoveryGuidance}</span>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Notice */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-start gap-2">
            <EyeOff className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-700">
              Raw salary amounts are never exposed. Version recovery restores only the
              cryptographic commitment hash for future zero-knowledge verification.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 bg-gray-50 border-t">
          <button
            type="button"
            onClick={onCancel}
            disabled={isRecovering}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="confirm-recovery-btn"
            onClick={handleConfirm}
            disabled={!result.ok || isRecovering}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isRecovering ? "Recovering…" : "Confirm Recovery"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommitmentVersionRecoveryDialog;
