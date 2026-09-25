import type { PayrollTransaction } from "@/types/models";

/**
 * Safe (no-salary-data) lifecycle counts for a payroll period (issue #371).
 *
 * Only ever counts — never surfaces amounts, employee ids, or wallet
 * addresses — so this can be shown on a dashboard summary without exposing
 * anything the underlying transactions themselves keep private.
 */
export interface PeriodStatusCounts {
  drafts: number;
  locked: number;
  cancelled: number;
  settled: number;
}

export const EMPTY_PERIOD_STATUS_COUNTS: PeriodStatusCounts = {
  drafts: 0,
  locked: 0,
  cancelled: 0,
  settled: 0,
};

/**
 * Buckets a list of payroll transactions into the four lifecycle stages the
 * summary card shows. `PayrollTransaction` doesn't have a single "locked"
 * status — "locked" here means finalized past the editable draft stage but
 * not yet executed: anything that isn't a draft, isn't cancelled, and isn't
 * settled (verified).
 */
export function derivePeriodSummary(
  transactions: PayrollTransaction[],
): PeriodStatusCounts {
  return transactions.reduce<PeriodStatusCounts>((counts, tx) => {
    if (tx.approvalStatus === "draft") {
      counts.drafts += 1;
    } else if (tx.status === "cancelled") {
      counts.cancelled += 1;
    } else if (tx.status === "verified") {
      counts.settled += 1;
    } else {
      counts.locked += 1;
    }
    return counts;
  }, { ...EMPTY_PERIOD_STATUS_COUNTS });
}

/** True when every lifecycle bucket is zero — the period has no activity yet. */
export function isPeriodSummaryEmpty(counts: PeriodStatusCounts): boolean {
  return counts.drafts + counts.locked + counts.cancelled + counts.settled === 0;
}
