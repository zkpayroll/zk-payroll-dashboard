import { describe, expect, it } from "vitest";
import { MOCK_TRANSACTIONS } from "@/lib/api/mockData";
import { matchesPayrollSearch, searchPayrollRuns } from "@/lib/payrollSearch";

describe("payroll history receipt reference search", () => {
  it("matches a verified transaction by its settlement receipt reference", () => {
    const verified = MOCK_TRANSACTIONS.find((tx) => tx.status === "verified")!;

    expect(matchesPayrollSearch(verified, `rcpt_${verified.id}`)).toBe(true);
    expect(searchPayrollRuns(MOCK_TRANSACTIONS, `rcpt_${verified.id}`)).toEqual([
      verified,
    ]);
  });

  it("does not invent a receipt reference for an unconfirmed transaction", () => {
    const pending = MOCK_TRANSACTIONS.find((tx) => tx.status === "pending")!;

    expect(matchesPayrollSearch(pending, `rcpt_${pending.id}`)).toBe(false);
  });
});
