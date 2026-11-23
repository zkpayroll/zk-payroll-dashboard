import { describe, expect, it } from "vitest";
import { sortTransactionsForHistory } from "@/src/payroll/transactionHistoryOrdering";

describe("sortTransactionsForHistory", () => {
  it("orders newest ledger events first and breaks same-ledger ties by transaction ID", () => {
    const transactions = [
      { id: "tx-z", timestamp: "2025-03-31T09:00:00Z" },
      { id: "tx-older", timestamp: "2025-03-30T09:00:00Z" },
      { id: "tx-a", timestamp: "2025-03-31T09:00:00Z" },
    ];

    expect(sortTransactionsForHistory(transactions).map(({ id }) => id)).toEqual([
      "tx-a",
      "tx-z",
      "tx-older",
    ]);
  });
});
