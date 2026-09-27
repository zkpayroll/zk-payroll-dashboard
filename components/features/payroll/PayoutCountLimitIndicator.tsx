"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { getPayoutLimitStatus, type PayoutLimitState } from "@/lib/payroll/payoutLimit";

interface PayoutCountLimitIndicatorProps {
  /** Number of payouts (employees) in the run. */
  count: number;
  /** Capacity policy `maxBatchSize`. */
  limit: number;
}

const STYLES: Record<PayoutLimitState, { box: string; bar: string; Icon: typeof Info }> = {
  ok: { box: "border-gray-200 bg-white text-gray-700", bar: "bg-indigo-500", Icon: CheckCircle2 },
  near: { box: "border-yellow-200 bg-yellow-50 text-yellow-800", bar: "bg-yellow-500", Icon: AlertTriangle },
  at: { box: "border-yellow-300 bg-yellow-50 text-yellow-900", bar: "bg-yellow-600", Icon: AlertTriangle },
  over: { box: "border-red-200 bg-red-50 text-red-800", bar: "bg-red-500", Icon: XCircle },
  unconfigured: { box: "border-gray-200 bg-gray-50 text-gray-600", bar: "bg-gray-300", Icon: Info },
};

/**
 * Shows how many payouts a run contains against the per-batch limit (#542).
 * Only counts are shown — never names, addresses or amounts.
 */
export function PayoutCountLimitIndicator({ count, limit }: PayoutCountLimitIndicatorProps) {
  const status = getPayoutLimitStatus(count, limit);
  const { box, bar, Icon } = STYLES[status.state];

  const message = (() => {
    switch (status.state) {
      case "over":
        return `This run exceeds the ${status.limit}-payout batch limit by ${status.count - status.limit}. Split it into ${status.batchesNeeded} batches or raise the limit in Payroll Policy → Capacity.`;
      case "at":
        return "This run is exactly at the batch limit — no more payouts can be added to it.";
      case "near":
        return `Approaching the batch limit — ${status.remaining} payout${status.remaining === 1 ? "" : "s"} remaining.`;
      case "unconfigured":
        return "No batch size limit is configured. Set one in Payroll Policy → Capacity.";
      default:
        return `${status.remaining} payout${status.remaining === 1 ? "" : "s"} remaining in this batch.`;
    }
  })();

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${box}`}
      data-testid="payout-limit-indicator"
      data-state={status.state}
      role={status.blocking ? "alert" : "status"}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          <Icon className="h-4 w-4" aria-hidden="true" />
          Payouts in this batch
        </span>
        <span className="font-mono font-semibold">
          {status.state === "unconfigured" ? status.count : `${status.count} / ${status.limit}`}
        </span>
      </div>
      {status.state !== "unconfigured" && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-label="Payout count against batch limit"
          aria-valuemin={0}
          aria-valuemax={status.limit}
          aria-valuenow={Math.min(status.count, status.limit)}
        >
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${status.percent}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs">{message}</p>
    </div>
  );
}

export default PayoutCountLimitIndicator;
