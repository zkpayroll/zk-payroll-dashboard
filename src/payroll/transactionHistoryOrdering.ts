import type { PayrollTransaction } from "@/types";

/** Sort newest ledger timestamps first, with a stable ID tie-break for one ledger. */
export function sortTransactionsForHistory<T extends Pick<PayrollTransaction, "id" | "timestamp">>(
  transactions: readonly T[],
): T[] {
  return [...transactions].sort((left, right) => {
    const leftTimestamp = Date.parse(left.timestamp);
    const rightTimestamp = Date.parse(right.timestamp);
    const leftHasTimestamp = Number.isFinite(leftTimestamp);
    const rightHasTimestamp = Number.isFinite(rightTimestamp);

    if (leftHasTimestamp && rightHasTimestamp && leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }
    if (leftHasTimestamp !== rightHasTimestamp) {
      return leftHasTimestamp ? -1 : 1;
    }

    return left.id.localeCompare(right.id);
  });
}
