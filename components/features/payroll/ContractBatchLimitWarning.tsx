"use client";

import { AlertTriangle } from "lucide-react";
import { getContractBatchLimitStatus } from "@/lib/payroll/contractBatchLimit";

interface ContractBatchLimitWarningProps {
  /** Number of payouts (employees) in the run. */
  count: number;
  /** Saved capacity policy `maxBatchSize`, used to flag a policy above the contract limit. */
  policyMaxBatchSize?: number | null;
}

/**
 * Warns when a run holds more payouts than the contract accepts in one
 * submission (#752). Renders nothing while the run fits comfortably. Only
 * counts are shown — never names, addresses or amounts.
 */
export function ContractBatchLimitWarning({ count, policyMaxBatchSize }: ContractBatchLimitWarningProps) {
  const status = getContractBatchLimitStatus(count, policyMaxBatchSize);
  if (status.state === "ok" && !(status.policyAboveContractLimit && status.count > 0)) return null;

  let message: string;
  if (status.state === "exceeds") {
    message = `This run has ${status.count} payouts, ${status.excess} over the contract limit of ${status.limit} per submission. It will be sent as ${status.submissionsNeeded} submissions, each needing its own signature.`;
  } else if (status.state === "at") {
    message = `This run is exactly at the contract limit of ${status.limit} payouts per submission. Adding one more payout will split it into 2 submissions.`;
  } else if (status.state === "near") {
    message = `Approaching the contract limit of ${status.limit} payouts per submission — ${status.remaining} remaining before the run is split.`;
  } else {
    message = `Your payroll policy allows ${policyMaxBatchSize} payouts per batch, above the contract limit of ${status.limit}. Larger runs are split into several submissions.`;
  }

  return (
    <div
      role="status"
      data-testid="contract-batch-limit-warning"
      data-state={status.state}
      className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">Contract batch limit</p>
        <p className="mt-1 text-xs">{message}</p>
        {status.state === "exceeds" && status.policyAboveContractLimit && (
          <p className="mt-1 text-xs">
            Lower the maximum batch size in Payroll Policy → Capacity to match the contract limit.
          </p>
        )}
      </div>
    </div>
  );
}

export default ContractBatchLimitWarning;
