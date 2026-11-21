import type { ReconciliationEntry } from "@/types/models";

export type PayoutConfirmationStatus = "confirmed" | "attention" | "empty";

export interface PayoutConfirmationReconciliation {
  status: PayoutConfirmationStatus;
  totalEntries: number;
  confirmedCount: number;
  discrepancyCount: number;
  missingCount: number;
  /** Expected minus confirmed, summed over unconfirmed entries. Never negative per entry. */
  unreconciledAmount: number;
  summaryMessage: string;
}

/**
 * Summarises payout confirmation reconciliation for the dashboard (#734).
 *
 * An entry is confirmed when its status is `confirmed`. A discrepancy or a
 * missing confirmation needs attention, and its shortfall is counted. Entry
 * names and identifiers are not part of the output.
 */
export function evaluatePayoutConfirmationReconciliation(
  entries: readonly ReconciliationEntry[],
): PayoutConfirmationReconciliation {
  let confirmedCount = 0;
  let discrepancyCount = 0;
  let missingCount = 0;
  let unreconciledAmount = 0;

  for (const entry of entries) {
    if (entry.status === "confirmed") {
      confirmedCount++;
      continue;
    }
    if (entry.status === "discrepancy") discrepancyCount++;
    else missingCount++;
    unreconciledAmount += Math.max(0, entry.expectedAmount - entry.confirmedAmount);
  }

  const attentionCount = discrepancyCount + missingCount;
  let status: PayoutConfirmationStatus = "confirmed";
  let summaryMessage = `All ${confirmedCount} payout${confirmedCount === 1 ? "" : "s"} confirmed on-chain.`;

  if (entries.length === 0) {
    status = "empty";
    summaryMessage = "No payouts to reconcile for this run yet.";
  } else if (attentionCount > 0) {
    status = "attention";
    summaryMessage = `${attentionCount} payout${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} review: ${discrepancyCount} with a discrepancy, ${missingCount} missing confirmation.`;
  }

  return {
    status,
    totalEntries: entries.length,
    confirmedCount,
    discrepancyCount,
    missingCount,
    unreconciledAmount,
    summaryMessage,
  };
}
