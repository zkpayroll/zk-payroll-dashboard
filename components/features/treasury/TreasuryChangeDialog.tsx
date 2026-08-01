"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertTriangle, Wallet, Loader2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useWalletStore } from "@/stores/walletStore";

interface TreasuryChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
}

export function TreasuryChangeDialog({
  isOpen,
  onClose,
  currentBalance,
}: TreasuryChangeDialogProps) {
  const [changeType, setChangeType] = useState<'add' | 'subtract' | 'set'>('add');
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');

  const router = useRouter();
  const { publicKey } = useWalletStore();

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleProceed = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for this treasury change.");
      return;
    }
    setError(null);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!publicKey) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newBalance = changeType === 'add' 
        ? currentBalance + parseFloat(amount)
        : changeType === 'subtract'
        ? Math.max(0, currentBalance - parseFloat(amount))
        : parseFloat(amount);

      const response = await fetch(`/api/treasury/balance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          balance: newBalance,
          reason: reason,
          changeType: changeType,
          previousBalance: currentBalance,
          signature: await generateSignature(publicKey, newBalance.toString(), changeType, reason),
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to update treasury balance");
      }

      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const generateSignature = async (wallet: string, balance: string, type: string, reason: string): Promise<string> => {
    const message = `Treasury balance change: ${type} ${balance} to ${balance}, reason: ${reason}, at ${new Date().toISOString()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return `0x${hashHex}`;
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep('form');
      setAmount("");
      setReason("");
      setError(null);
    }, 300);
  };

  const getBalanceResult = () => {
    const numAmount = parseFloat(amount) || 0;
    switch (changeType) {
      case 'add':
        return currentBalance + numAmount;
      case 'subtract':
        return Math.max(0, currentBalance - numAmount);
      case 'set':
        return numAmount;
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString()}`;
  };

  return (
    <ConfirmationDialog
      title={
        step === 'form' ? 'Modify Treasury Balance'
          : step === 'confirm' ? 'Confirm Treasury Change'
          : 'Balance Updated'
      }
      description={
        step === 'form' 
          ? "Modify the treasury balance. Changes are recorded and audited for compliance."
          : step === 'confirm'
          ? `Modify the treasury balance from ${formatCurrency(currentBalance)} to ${formatCurrency(getBalanceResult())}. This action will be logged and audited.`
          : `Treasury balance has been successfully updated to ${formatCurrency(getBalanceResult())}. The change has been logged for audit purposes.`
      }
      warning={
        step === 'form' 
          ? "Treasury changes affect all payroll operations. Ensure you have proper authorization before making this change."
          : step === 'confirm'
          ? "This will immediately update the treasury balance and affect all payroll operations. All transactions will be logged."
          : "Treasury balance modification has been completed and logged for compliance."
      }
      confirmText={step === 'confirm' ? 'Update Treasury' : 'Done'}
      cancelText={step === 'success' ? 'Close' : 'Cancel'}
      variant={changeType === 'subtract' && getBalanceResult() < 25000 ? 'danger' : 'warning'}
      icon="shield"
      isOpen={isOpen}
      onConfirm={step === 'confirm' ? () => handleConfirm() : async () => {}}
      onCancel={step === 'success' ? handleClose : handleClose}
      isLoading={isLoading}
      showReasonField={step === 'form'}
      reasonLabel="Change Reason"
      reasonPlaceholder="e.g., Bonus allocation, operational expense, reserve adjustment..."
    >
      {step === 'form' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => { setChangeType('add'); setError(null); }}
              className={`p-3 rounded-lg border-2 transition-colors ${
                changeType === 'add'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-medium">Add Balance</div>
              <div className="text-xs text-gray-500 mt-1">Increase treasury</div>
            </button>
            <button
              onClick={() => { setChangeType('subtract'); setError(null); }}
              className={`p-3 rounded-lg border-2 transition-colors ${
                changeType === 'subtract'
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-medium">Subtract Balance</div>
              <div className="text-xs text-gray-500 mt-1">Decrease treasury</div>
            </button>
            <button
              onClick={() => { setChangeType('set'); setError(null); }}
              className={`p-3 rounded-lg border-2 transition-colors ${
                changeType === 'set'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-medium">Set Balance</div>
              <div className="text-xs text-gray-500 mt-1">Directly set amount</div>
            </button>
          </div>

          <div>
            <label htmlFor="treasury-amount" className="block text-sm font-medium text-gray-700 mb-2">
              Amount ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                id="treasury-amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium text-gray-700">Balance Summary</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Current Balance</span>
                <span className="font-medium">{formatCurrency(currentBalance)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Proposed Change</span>
                <span
                  className={
                    changeType === 'add'
                      ? 'text-green-600'
                      : changeType === 'subtract'
                      ? 'text-amber-600'
                      : 'text-blue-600'
                  }
                >
                  {changeType === 'add' ? '+' : changeType === 'subtract' ? '-' : ''}
                  {parseFloat(amount || '0').toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">New Balance</span>
                <span
                  className={
                    getBalanceResult() < 25000
                      ? 'text-red-600 font-semibold'
                      : 'text-gray-900 font-semibold'
                  }
                >
                  {formatCurrency(getBalanceResult())}
                </span>
              </div>
            </div>
            {getBalanceResult() < 25000 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-800">Low Balance Warning</p>
                    <p className="text-xs text-amber-700 mt-1">
                      New balance would be less than $25,000 safety buffer. This may affect payroll processing.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleProceed}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Wallet className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-blue-800">Treasury Modification Confirmation</h4>
              <div className="text-xs text-blue-700 mt-1 space-y-1">
                <p>• Action: {changeType}</p>
                <p>• Amount: ${parseFloat(amount).toLocaleString()}</p>
                <p>• Previous Balance: {formatCurrency(currentBalance)}</p>
                <p>• New Balance: {formatCurrency(getBalanceResult())}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-green-800">Treasury Updated Successfully</h4>
              <p className="text-sm text-green-700 mt-1">
                Treasury balance has been updated and the change has been logged for audit purposes. All future payroll operations will use the new balance.
              </p>
            </div>
          </div>
        </div>
      )}
    </ConfirmationDialog>
  );
}

export default TreasuryChangeDialog;
