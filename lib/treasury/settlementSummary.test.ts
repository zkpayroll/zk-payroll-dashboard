import { describe, expect, it } from "vitest";
import { summarizeTreasurySettlements } from "./settlementSummary";

describe("summarizeTreasurySettlements", () => {
  it("reports current reserved and settled amounts without counting retries twice", () => {
    expect(
      summarizeTreasurySettlements([
        { id: "run-a-attempt-1", runId: "run-a", amount: 1000, state: "failed" },
        { id: "run-a-attempt-2", runId: "run-a", amount: 1000, state: "settled" },
        { id: "run-b", amount: 2500, state: "reserved" },
        { id: "run-c", amount: 400, state: "released" },
      ]),
    ).toEqual({ reserved: 2500, settled: 1000, released: 400, failed: 0, retryCount: 1 });
  });

  it("ignores malformed amounts and preserves failed current attempts", () => {
    expect(
      summarizeTreasurySettlements([
        { id: "run-a", amount: Number.NaN, state: "reserved" },
        { id: "run-b", amount: 800, state: "failed" },
      ]),
    ).toEqual({ reserved: 0, settled: 0, released: 0, failed: 800, retryCount: 0 });
  });
});
