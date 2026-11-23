"use client";

import { useMemo } from "react";
import { Lock, AlertCircle, Info } from "lucide-react";
import { useWalletRotationStore } from "@/stores/walletRotation";

interface RecipientLockBadgeProps {
  employeeId: string;
  employeeName?: string;
  className?: string;
  variant?: "inline" | "banner";
}

export function RecipientLockBadge({
  employeeId,
  employeeName,
  className = "",
  variant = "inline",
}: RecipientLockBadgeProps) {
  const isCooldownActive = useWalletRotationStore((s) => s.isCooldownActive(employeeId));
  const getWarningsForEmployee = useWalletRotationStore((s) => s.getWarningsForEmployee);
  const getRequestForEmployee = useWalletRotationStore((s) => s.getRequestForEmployee);

  const warnings = useMemo(() => getWarningsForEmployee(employeeId), [getWarningsForEmployee, employeeId]);
  const request = useMemo(() => getRequestForEmployee(employeeId), [getRequestForEmployee, employeeId]);

  const cooldownWarning = warnings.find((w) => w.type === "cooldown_active");

  if (!isCooldownActive && !cooldownWarning) {
    return null;
  }

  const expiresAt = cooldownWarning?.message.match(/until (.+)\. Payroll/)?.[1];
  const expiresDate = expiresAt ? new Date(expiresAt) : null;
  const timeRemaining = expiresDate ? expiresDate.getTime() - Date.now() : null;
  const hoursRemaining = timeRemaining && timeRemaining > 0 ? Math.ceil(timeRemaining / (1000 * 60 * 60)) : 0;

  if (variant === "banner") {
    return (
      <div
        role="alert"
        aria-live="polite"
        className={`rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 ${className}`}
      >
        <Lock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-amber-800">
            Payout Destination Locked
          </h4>
          <p className="mt-1 text-sm text-amber-700">
            {employeeName ? `${employeeName}'s` : "This employee's"} payout destination cannot be changed due to an active wallet rotation cooldown.
            {hoursRemaining > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                <Info className="w-3 h-3" aria-hidden="true" />
                Cooldown expires in {hoursRemaining}h
              </span>
            )}
            {expiresDate && (
              <p className="mt-1 text-xs text-amber-600">
                Expires: {expiresDate.toLocaleString()}
              </p>
            )}
          </p>
          {request?.status === "pending" && (
            <p className="mt-2 text-xs text-amber-600">
              Awaiting approval for wallet rotation request.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-50 text-amber-800 border-amber-200 ${className}`}
      aria-label="Payout destination locked due to wallet rotation cooldown"
    >
      <Lock className="w-3 h-3" aria-hidden="true" />
      <span>Destination Locked</span>
      {hoursRemaining > 0 && (
        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded-full">
          {hoursRemaining}h
        </span>
      )}
    </span>
  );
}

export default RecipientLockBadge;
