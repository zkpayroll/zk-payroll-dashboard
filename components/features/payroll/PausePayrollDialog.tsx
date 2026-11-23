"use client";

import { useState } from "react";
import { AlertTriangle, ShieldAlert, Loader2, X, AlertCircle } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { PayrollRun } from "@/types/models";
import type { UserRole } from "@/types";
import { canPausePayroll, getPauseRestrictionReason } from "@/lib/auth/roles";

interface PausePayrollDialogProps {
  isOpen: boolean;
  payroll: PayrollRun;
  userRole?: UserRole;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * Emergency payroll pause dialog (#665).
 *
 * Deliberately modeled on `CancelPayrollDialog`'s API call shape and layout,
 * but admin-only and reversible: pausing halts an in-flight run without
 * discarding it (unlike cancellation, which is final), so an investigation
 * can run and the batch can be resumed with `DELETE /api/payroll/[id]/pause`
 * once cleared.
 */
export function PausePayrollDialog({
  isOpen,
  payroll,
  userRole = "operator",
  onCancel,
  onSuccess,
}: PausePayrollDialogProps) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { publicKey } = useWalletStore();

  if (!isOpen) return null;

  const isAuthorized = canPausePayroll(userRole);
  const restrictionReason = getPauseRestrictionReason(userRole);

  const handleConfirmPause = async () => {
    if (!isAuthorized) {
      setError(restrictionReason);
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      setReasonError("Describe why this run is being paused (at least 3 characters).");
      return;
    }

    if (!publicKey) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError(null);
    setReasonError(null);

    try {
      const response = await fetch(`/api/payroll/${payroll.id}/pause`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer dGVzdA.${Buffer.from(
            JSON.stringify({ role: userRole, publicKey }),
          ).toString("base64")}.sig`,
        },
        body: JSON.stringify({ reason: trimmedReason }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to pause payroll run");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="pause-payroll-dialog"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        <div
          className="bg-amber-50 border-b border-amber-200 p-6 flex items-start gap-3"
          role="alert"
          aria-labelledby="pause-dialog-title"
          aria-describedby="pause-dialog-description"
        >
          <div className="text-amber-600 p-2 rounded-lg bg-amber-100 flex-shrink-0">
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="pause-dialog-title" className="font-semibold text-lg text-amber-800">
              Emergency Pause Payroll Run?
            </h2>
            <p id="pause-dialog-description" className="text-sm mt-1 text-amber-700">
              This halts the run without cancelling it. Dispatch will not proceed while paused, and an admin can resume it later from the same state it was in.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {!isAuthorized && restrictionReason && (
            <div
              data-testid="role-pause-restriction-alert"
              className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Role Restriction</p>
                <p className="mt-0.5">{restrictionReason}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3.5 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Payroll ID</span>
              <span className="font-mono text-gray-900 font-medium">{payroll.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Amount</span>
              <span className="font-semibold text-gray-900">${payroll.totalAmount?.toLocaleString() || "0"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Status</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                {payroll.status}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="pause-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Pause <span className="text-red-500">*</span>
            </label>
            <textarea
              id="pause-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(null);
              }}
              placeholder="e.g. Suspected duplicate batch — investigating before dispatch"
              disabled={isLoading || !isAuthorized}
              rows={2}
              aria-describedby={reasonError ? "pause-reason-error" : undefined}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
            />
            {reasonError && (
              <p id="pause-reason-error" role="alert" className="text-xs text-red-600 mt-1">
                {reasonError}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-4 bg-gray-50 border-t">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            Keep Running
          </button>
          <button
            type="button"
            onClick={handleConfirmPause}
            disabled={isLoading || !isAuthorized}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Pausing...
              </>
            ) : (
              "Pause Payroll"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PausePayrollDialog;
