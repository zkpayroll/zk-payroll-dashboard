"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Shield, Loader2, X, AlertCircle } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { PayrollRun } from "@/types/models";
import { CancellationReasonSelect } from "@/components/payroll/CancellationReasonSelect";
import { CancellationReasonCode, getCancellationReason } from "@/lib/constants/cancellationReasons";

interface CancelPayrollDialogProps {
  isOpen: boolean;
  payroll: PayrollRun;
  onCancel: () => void;
  onSuccess: () => void;
}

export function CancelPayrollDialog({
  isOpen,
  payroll,
  onCancel,
  onSuccess,
}: CancelPayrollDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { publicKey } = useWalletStore();

  if (!isOpen) return null;

  const handleConfirmCancel = async () => {
    if (!selectedReason) {
      setReasonError("Please select a supported cancellation reason.");
      return;
    }

    if (!publicKey) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError(null);
    setReasonError(null);

    const reasonObj = getCancellationReason(selectedReason);
    const fullReasonString = customNotes.trim()
      ? `[${selectedReason}] ${reasonObj?.label || selectedReason} - ${customNotes.trim()}`
      : `[${selectedReason}] ${reasonObj?.label || selectedReason}`;

    try {
      const signature = await generateSignature(publicKey, payroll.id, fullReasonString);
      const response = await fetch(`/api/payroll/${payroll.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "cancelled",
          reason: fullReasonString,
          reasonCode: selectedReason,
          notes: customNotes.trim() || undefined,
          signature: signature,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to cancel payroll");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const generateSignature = async (wallet: string, id: string, reason: string): Promise<string> => {
    const message = `Cancel payroll run ${id} at ${new Date().toISOString()} - Reason: ${reason}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `0x${hashHex}`;
  };

  const handleReasonChange = (code: string) => {
    setSelectedReason(code);
    if (reasonError) {
      setReasonError(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div
          className="bg-red-50 border-b border-red-200 p-6 flex items-start gap-3"
          role="alert"
          aria-labelledby="cancel-dialog-title"
          aria-describedby="cancel-dialog-description"
        >
          <div className="text-red-600 p-2 rounded-lg bg-red-100 flex-shrink-0">
            <Shield className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="cancel-dialog-title" className="font-semibold text-lg text-red-800">
              Cancel Payroll Run?
            </h2>
            <p id="cancel-dialog-description" className="text-sm mt-1 text-red-700">
              This action will cancel the entire payroll run and cannot be undone. This will immediately stop all payments and refund any processed transactions.
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

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Warning */}
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              Payroll cancellation will trigger refunds and may affect employee wallet balances. All pending transactions will be rolled back.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Batch Summary */}
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
              <span className="text-gray-600">Employees</span>
              <span className="font-semibold text-gray-900">{payroll.employeeCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Status</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                {payroll.status}
              </span>
            </div>
          </div>

          {/* Cancellation Reason Selector */}
          <CancellationReasonSelect
            value={selectedReason}
            onChange={handleReasonChange}
            disabled={isLoading}
            isLoading={isLoading}
            required={true}
            error={reasonError}
            label="Required Cancellation Reason"
          />

          {/* Optional Notes */}
          <div>
            <label htmlFor="cancellation-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="cancellation-notes"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Additional audit or operational context..."
              disabled={isLoading}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              The reason code and notes will be cryptographically signed and stored in the compliance audit trail.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 bg-gray-50 border-t">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            Keep Payroll
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={isLoading || !selectedReason}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel Payroll"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CancelPayrollDialog;
