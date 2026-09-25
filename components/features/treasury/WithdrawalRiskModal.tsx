"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Shield, Lock, CheckCircle, TrendingDown } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useTreasuryStore } from "@/stores/treasury";
import {
  computeWithdrawalRisk,
  type WithdrawalRiskLevel,
} from "@/lib/treasury/withdrawalRisk";

interface WithdrawalRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  withdrawalAmount: number;
  assetCode?: string;
}

const VARIANTS: Record<WithdrawalRiskLevel, { variant: "danger" | "warning" | "info"; icon: "alert" | "shield" | "warning" }> = {
  blocked: { variant: "danger", icon: "alert" },
  risky: { variant: "warning", icon: "warning" },
  safe: { variant: "info", icon: "shield" },
};

const RISK_LABELS: Record<WithdrawalRiskLevel, string> = {
  blocked: "Withdrawal Blocked",
  risky: "Risky Withdrawal",
  safe: "Withdrawal Approved",
};

export function WithdrawalRiskModal({
  isOpen,
  onClose,
  onConfirm,
  withdrawalAmount,
  assetCode = "USDC",
}: WithdrawalRiskModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const { balances, obligations } = useTreasuryStore();

  const risk = useMemo(() => {
    const balance = balances[assetCode] ?? {
      assetCode,
      available: 0,
      reserved: 0,
      projected: 0,
    };
    return computeWithdrawalRisk(balance, withdrawalAmount, obligations);
  }, [balances, assetCode, withdrawalAmount, obligations]);

  const { riskLevel, message, details, assetLabel } = risk;
  const { variant, icon } = VARIANTS[riskLevel];
  const isBlocked = riskLevel === "blocked";
  const isRisky = riskLevel === "risky";

  const handleConfirm = async () => {
    if (isRisky && !acknowledged) return;
    onConfirm();
  };

  const handleClose = () => {
    setAcknowledged(false);
    onClose();
  };

  return (
    <ConfirmationDialog
      title={RISK_LABELS[riskLevel]}
      description={message}
      warning={
        isBlocked
          ? "This withdrawal cannot proceed. Reduce the amount or fund the treasury first."
          : isRisky
            ? "You must acknowledge the risk before proceeding with this withdrawal."
            : undefined
      }
      confirmText={isBlocked ? "Blocked" : isRisky ? "Confirm Withdrawal" : "Proceed"}
      cancelText="Cancel"
      variant={variant}
      icon={icon}
      isOpen={isOpen}
      onConfirm={isBlocked ? async () => {} : handleConfirm}
      onCancel={handleClose}
      isLoading={false}
    >
      <div className="space-y-4" role="region" aria-label="Balance breakdown">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-gray-500" aria-hidden="true" />
            Balance Breakdown ({assetLabel})
          </h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Available Balance</dt>
              <dd className="font-medium text-gray-900" data-testid="available-balance">
                ${details.available.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 flex items-center gap-1">
                <Lock className="w-3 h-3" aria-hidden="true" />
                Reserved for Payroll
              </dt>
              <dd className="font-medium text-gray-900" data-testid="reserved-balance">
                ${details.reserved.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Projected Obligations</dt>
              <dd className="font-medium text-gray-900" data-testid="projected-balance">
                ${details.projected.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Locked Payroll Total</dt>
              <dd className="font-medium text-gray-900" data-testid="obligation-total">
                ${details.obligationTotal.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <dt className="font-semibold text-gray-800">Withdrawal Amount</dt>
              <dd className="font-semibold text-red-600" data-testid="withdrawal-amount">
                -${withdrawalAmount.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-semibold text-gray-800">Post-Withdrawal Balance</dt>
              <dd
                className={`font-semibold ${
                  details.violatesReserved || details.fallsBelowBuffer
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
                data-testid="post-withdrawal-balance"
              >
                ${details.postWithdrawal.toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        {details.violatesReserved && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2"
            data-testid="violation-alert"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-red-700">
              This withdrawal violates locked payroll requirements. The available balance
              is insufficient to cover this withdrawal amount.
            </p>
          </div>
        )}

        {isRisky && (
          <label
            className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-amber-200 bg-amber-50"
            data-testid="acknowledgment-label"
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              disabled={isBlocked}
              aria-label="I acknowledge the withdrawal risk"
            />
            <span className="text-sm text-amber-800">
              I understand this withdrawal reduces the safety buffer and may affect upcoming
              payroll execution. I confirm this withdrawal is intentional.
            </span>
          </label>
        )}

        {isBlocked && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50">
            <Shield className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-red-700">
              This withdrawal is blocked to protect payroll obligations. The treasury must
              retain sufficient funds to cover all reserved and projected payroll runs.
            </p>
          </div>
        )}

        {!isBlocked && !isRisky && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-emerald-700">
              This withdrawal is within the available surplus. Payroll obligations remain
              fully covered.
            </p>
          </div>
        )}
      </div>
    </ConfirmationDialog>
  );
}

export default WithdrawalRiskModal;
