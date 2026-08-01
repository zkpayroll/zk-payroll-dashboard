"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Shield, Loader2, X } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useWalletStore } from "@/stores/walletStore";
import { PayrollRun } from "@/types/models";

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { publicKey } = useWalletStore();

  const handleCancel = async (reason?: string) => {
    if (!publicKey) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const signature = await generateSignature(publicKey, payroll.id, reason || "");
      const response = await fetch(`/api/payroll/${payroll.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "cancelled",
          reason: reason,
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
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return `0x${hashHex}`;
  };

  return (
    <ConfirmationDialog
      title="Cancel Payroll Run?"
      description="This action will cancel the entire payroll run and cannot be undone. This will immediately stop all payments and refund any processed transactions."
      warning="Payroll cancellation will trigger refunds and may affect employee wallet balances. All pending transactions will be rolled back."
      confirmText="Cancel Payroll"
      cancelText="Keep Payroll"
      variant="danger"
      icon="shield"
      isOpen={isOpen}
      onConfirm={handleCancel}
      onCancel={onCancel}
      isLoading={isLoading}
      showReasonField={true}
      reasonLabel="Cancellation Reason"
      reasonPlaceholder="e.g., Error in payroll calculation, system maintenance, etc."
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Payroll ID</span>
          <span className="text-sm font-mono">{payroll.id}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Amount</span>
          <span className="text-sm font-semibold">${payroll.totalAmount?.toLocaleString() || "0"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Employees</span>
          <span className="text-sm font-semibold">{payroll.employeeCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Status</span>
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            {payroll.status}
          </span>
        </div>
      </div>
    </ConfirmationDialog>
  );
}

export default CancelPayrollDialog;
