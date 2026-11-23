import { describe, expect, it } from "vitest";
import { compareReservedToPayout } from "@/lib/reconciliation/reservationComparison";
import {
  buildReconciliationDashboard,
  mergeAssetAmounts,
  summarizeRun,
  type ReconciliationAssetAmount,
  type ReconciliationPeriodInput,
  type ReconciliationRunInput,
} from "@/lib/sdk/reconciliation";

const usdc = { code: "USDC" };
const xlm = { code: "XLM" };

function asset(
  code: { code: string },
  liability: number,
  reserved?: number,
  settled = liability,
): ReconciliationAssetAmount {
  return {
    asset: code,
    liability,
    settled,
    outstanding: Math.max(0, liability - settled),
    ...(reserved === undefined ? {} : { reserved }),
  };
}

function run(id: string, assets: ReconciliationAssetAmount[]): ReconciliationRunInput {
  return { payrollRunId: id, label: id, status: "completed", assets, blockers: [] };
}

describe("compareReservedToPayout (#860)", () => {
  it("matches when the payout equals the reservation", () => {
    const result = compareReservedToPayout("USDC", 1000, 1000);
    expect(result.status).toBe("matched");
    expect(result.difference).toBe(0);
    expect(result.message).toContain("matches");
  });

  it("flags an over-reservation and says how much to release", () => {
    const result = compareReservedToPayout("USDC", 1000, 940.5);
    expect(result.status).toBe("over_reserved");
    expect(result.difference).toBeCloseTo(-59.5, 7);
    expect(result.message).toContain("59.5");
    expect(result.message).toMatch(/Release the excess/);
  });

  it("flags an under-reservation and says how much is unfunded", () => {
    const result = compareReservedToPayout("XLM", 500, 512);
    expect(result.status).toBe("under_reserved");
    expect(result.difference).toBe(12);
    expect(result.message).toMatch(/exceeds the 500 reserved by 12/);
    expect(result.message).toMatch(/Increase the reservation/);
  });

  it("treats a one-stroop difference as a mismatch (boundary)", () => {
    expect(compareReservedToPayout("XLM", 100, 100.0000001).status).toBe("under_reserved");
    expect(compareReservedToPayout("XLM", 100, 99.9999999).status).toBe("over_reserved");
  });

  it("does not report floating point noise as a mismatch", () => {
    expect(compareReservedToPayout("XLM", 0.3, 0.1 + 0.2).status).toBe("matched");
  });

  it("asks for a reservation when there is a payout but nothing reserved", () => {
    const result = compareReservedToPayout("USDC", undefined, 250);
    expect(result.status).toBe("no_reservation");
    expect(result.message).toMatch(/no recorded reservation/);
  });

  it("matches a zero payout with no reservation", () => {
    expect(compareReservedToPayout("USDC", undefined, 0).status).toBe("matched");
    expect(compareReservedToPayout("USDC", 0, 0).status).toBe("matched");
  });

  it.each([
    ["NaN payout", 100, Number.NaN],
    ["infinite payout", 100, Number.POSITIVE_INFINITY],
    ["negative payout", 100, -1],
    ["negative reservation", -5, 100],
    ["NaN reservation", Number.NaN, 100],
  ])("rejects %s with an actionable message", (_label, reserved, payout) => {
    const result = compareReservedToPayout("USDC", reserved, payout);
    expect(result.status).toBe("invalid");
    expect(result.message).toMatch(/cannot be compared/);
  });

  it("only mentions the asset and aggregate totals", () => {
    const { message } = compareReservedToPayout("USDC", 1000, 1200);
    expect(message).not.toMatch(/employee|salary|wallet|G[A-Z2-7]{20,}/i);
  });
});

describe("reconciliation summary with reservations (#860)", () => {
  it("leaves runs without reservation data untouched", () => {
    const summary = summarizeRun(run("run_a", [asset(usdc, 100)]));
    expect(summary.reservationChecks).toEqual([]);
    expect(summary.blockers).toEqual([]);
    expect(summary.health).toBe("healthy");
  });

  it("is healthy when the payout matches the reservation", () => {
    const summary = summarizeRun(run("run_a", [asset(usdc, 100, 100)]));
    expect(summary.reservationChecks).toHaveLength(1);
    expect(summary.health).toBe("healthy");
  });

  it("blocks a run whose payout exceeds the reservation, as a mismatch", () => {
    const summary = summarizeRun(run("run_a", [asset(usdc, 120, 100)]));
    expect(summary.health).toBe("blocked");
    expect(summary.blockers).toHaveLength(1);
    expect(summary.blockers[0]).toMatchObject({ category: "mismatches", payrollRunId: "run_a" });
    expect(summary.blockers[0].description).toMatch(/exceeds the 100 reserved by 20/);
  });

  it("warns, without blocking, when the reservation is larger than the payout", () => {
    const summary = summarizeRun(run("run_a", [asset(usdc, 80, 100)]));
    expect(summary.health).toBe("warning");
    expect(summary.blockers).toEqual([]);
    expect(summary.reservationChecks[0].status).toBe("over_reserved");
  });

  it("compares each asset separately and never adds different assets together", () => {
    const summary = summarizeRun(run("run_a", [asset(usdc, 100, 100), asset(xlm, 50, 80)]));
    expect(summary.reservationChecks.map((c) => [c.assetCode, c.status])).toEqual([
      ["USDC", "matched"],
      ["XLM", "over_reserved"],
    ]);
  });

  it("does not carry a per-run reserved figure into merged totals", () => {
    const merged = mergeAssetAmounts([[asset(usdc, 100, 100)], [asset(usdc, 50, 50)]]);
    expect(merged).toEqual([{ asset: usdc, liability: 150, settled: 150, outstanding: 0 }]);
  });

  it("keeps one run's shortfall visible when another run in the period is fine", () => {
    const period: ReconciliationPeriodInput = {
      periodId: "2026-11",
      periodLabel: "November 2026",
      runs: [run("run_ok", [asset(usdc, 100, 100)]), run("run_short", [asset(usdc, 90, 60)])],
    };
    const dashboard = buildReconciliationDashboard([period]);
    const [summary] = dashboard.periods;

    expect(summary.reservationChecks.map((c) => c.status)).toEqual(["matched", "under_reserved"]);
    expect(summary.health).toBe("blocked");
    expect(summary.blockersByCategory.mismatches).toHaveLength(1);
    expect(dashboard.overallHealth).toBe("blocked");
    expect(dashboard.totalBlockerCount).toBe(1);
  });

  it("does not drop blockers the run already had", () => {
    const input = run("run_a", [asset(usdc, 120, 100)]);
    input.blockers = [{ category: "holds", payrollRunId: "run_a", description: "Compliance hold" }];
    const summary = summarizeRun(input);
    expect(summary.blockers.map((b) => b.category)).toEqual(["holds", "mismatches"]);
  });
});
