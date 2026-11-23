"use client";

import { useId } from "react";
import { Info } from "lucide-react";

export interface PayoutMinimumThresholdHelperProps {
  minimumThreshold?: number;
  currencySymbol?: string;
  description?: string;
}

export function PayoutMinimumThresholdHelper({
  minimumThreshold = 0.01,
  currencySymbol = "$",
  description,
}: PayoutMinimumThresholdHelperProps) {
  const helperId = useId();

  const defaultDescription =
    description ||
    `Payouts below the minimum threshold of ${currencySymbol}${minimumThreshold.toFixed(2)} will be held and consolidated in the next cycle.`;

  return (
    <div
      id={helperId}
      className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700"
      role="note"
      data-testid="payout-minimum-threshold-helper"
    >
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{defaultDescription}</span>
    </div>
  );
}

export default PayoutMinimumThresholdHelper;
