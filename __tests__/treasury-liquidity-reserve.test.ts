import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESERVE_STALE_AFTER_MS,
  DEFAULT_TARGET_RESERVE_PERCENT,
  evaluateTreasuryLiquidityReserve,
  formatReserveRatioPercent,
  formatTreasuryAmount,
  resolveTargetReservePercent,
} from "@/lib/treasury/liquidityReserve";
import type {
  TreasuryLiquidityReserveEvaluatedResult,
  TreasuryLiquidityReserveSnapshot,
} from "@/types/treasury";

const NOW = new Date("2026-10-02T12:00:00Z");
const CONFIG = { targetReservePercent: 150, staleAfterMs: DEFAULT_RESERVE_STALE_AFTER_MS };

function snapshot(
  overrides: Partial<TreasuryLiquidityReserveSnapshot> = {},
): TreasuryLiquidityReserveSnapshot {
  return {
    assetCode: "USDC",
    balance: 45_000,
    nextPayrollObligation: 19_500,
    lastUpdated: "2026-10-02T11:58:00Z",
    ...overrides,
  };
}

function evaluate(
  overrides: Partial<TreasuryLiquidityReserveSnapshot> = {},
  config = CONFIG,
): TreasuryLiquidityReserveEvaluatedResult {
  const result = evaluateTreasuryLiquidityReserve(snapshot(overrides), config, NOW);
  if (result.kind !== "evaluated") {
    throw new Error(`Expected an evaluated result, got ${result.kind}`);
  }
  return result;
}

describe("evaluateTreasuryLiquidityReserve", () => {
  describe("status thresholds", () => {
    it("is healthy above the target reserve", () => {
      const result = evaluate();

      expect(result.status).toBe("healthy");
      expect(result.reserveRatioBps).toBe(23_076);
      expect(result.runsCovered).toBe(2);
      expect(result.shortfall).toBe("0");
      expect(result.amountBelowTarget).toBe("0");
      expect(result.targetBalance).toBe("29250");
    });

    it("is healthy exactly at the target reserve", () => {
      const result = evaluate({ balance: 15_000, nextPayrollObligation: 10_000 });

      expect(result.status).toBe("healthy");
      expect(result.reserveRatioBps).toBe(15_000);
      expect(result.amountBelowTarget).toBe("0");
    });

    it("is low one base unit below the target reserve", () => {
      const result = evaluate({ balance: "14999.9999999", nextPayrollObligation: 10_000 });

      expect(result.status).toBe("low");
      expect(result.shortfall).toBe("0");
      expect(result.amountBelowTarget).toBe("0.0000001");
    });

    it("is low when the balance exactly covers the next run", () => {
      const result = evaluate({ balance: 10_000, nextPayrollObligation: 10_000 });

      expect(result.status).toBe("low");
      expect(result.reserveRatioBps).toBe(10_000);
      expect(result.runsCovered).toBe(1);
      expect(result.shortfall).toBe("0");
      expect(result.amountBelowTarget).toBe("5000");
    });

    it("is critical one base unit below the next run and reports the shortfall", () => {
      const result = evaluate({ balance: "9999.9999999", nextPayrollObligation: 10_000 });

      expect(result.status).toBe("critical");
      expect(result.runsCovered).toBe(0);
      expect(result.shortfall).toBe("0.0000001");
    });

    it("is critical with the full obligation as shortfall when the balance is zero", () => {
      const result = evaluate({ balance: 0, nextPayrollObligation: 19_500 });

      expect(result.status).toBe("critical");
      expect(result.balance).toBe("0");
      expect(result.reserveRatioBps).toBe(0);
      expect(result.runsCovered).toBe(0);
      expect(result.shortfall).toBe("19500");
    });
  });

  describe("no scheduled payroll", () => {
    it.each([0, "0", "0.00", null, undefined])(
      "returns an empty state instead of dividing by zero for obligation %s",
      (nextPayrollObligation) => {
        const result = evaluateTreasuryLiquidityReserve(
          snapshot({ nextPayrollObligation }),
          CONFIG,
          NOW,
        );

        expect(result.kind).toBe("no_scheduled_payroll");
        expect(result).toMatchObject({ balance: "45000" });
      },
    );

    it("still treats a zero balance with no scheduled payroll as an empty state", () => {
      const result = evaluateTreasuryLiquidityReserve(
        snapshot({ balance: 0, nextPayrollObligation: 0 }),
        CONFIG,
        NOW,
      );

      expect(result.kind).toBe("no_scheduled_payroll");
    });
  });

  describe("invalid input", () => {
    it.each([
      ["negative number", -1],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["negative string", "-250.5"],
      ["non-numeric string", "lots"],
      ["formatted string", "45,000"],
      ["exponent string", "1e5"],
      ["blank string", "   "],
      ["more than 7 decimals", "1.00000001"],
      ["missing", undefined],
      ["null", null],
      ["unsafe integer", Number.MAX_SAFE_INTEGER * 2],
    ])("rejects a %s balance instead of reporting a status", (_label, balance) => {
      const result = evaluateTreasuryLiquidityReserve(
        snapshot({ balance: balance as never }),
        CONFIG,
        NOW,
      );

      expect(result.kind).toBe("invalid");
      if (result.kind !== "invalid") return;
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].field).toBe("balance");
      expect(result.issues[0].message).toMatch(/treasury balance/i);
      expect(result.issues[0].message).toMatch(/Refresh the reading/);
    });

    it.each([
      ["negative", -19_500],
      ["NaN", Number.NaN],
      ["non-numeric", "abc"],
      ["object", {}],
    ])("rejects a %s obligation", (_label, nextPayrollObligation) => {
      const result = evaluateTreasuryLiquidityReserve(
        snapshot({ nextPayrollObligation: nextPayrollObligation as never }),
        CONFIG,
        NOW,
      );

      expect(result.kind).toBe("invalid");
      if (result.kind !== "invalid") return;
      expect(result.issues.map((issue) => issue.field)).toEqual(["nextPayrollObligation"]);
      expect(result.issues[0].message).toMatch(/next payroll amount/i);
    });

    it("reports both readings when both are invalid", () => {
      const result = evaluateTreasuryLiquidityReserve(
        snapshot({ balance: Number.NaN, nextPayrollObligation: -5 }),
        CONFIG,
        NOW,
      );

      expect(result.kind).toBe("invalid");
      if (result.kind !== "invalid") return;
      expect(result.issues.map((issue) => issue.field)).toEqual([
        "balance",
        "nextPayrollObligation",
      ]);
    });

    it("does not echo raw invalid readings back in messages", () => {
      const result = evaluateTreasuryLiquidityReserve(
        snapshot({ balance: "<script>alert(1)</script>" }),
        CONFIG,
        NOW,
      );

      expect(JSON.stringify(result)).not.toContain("script");
    });
  });

  describe("money precision", () => {
    it("does not let float noise push an exact-threshold balance into low", () => {
      // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754.
      const result = evaluate({ balance: 0.1 + 0.2, nextPayrollObligation: 0.2 });

      expect(result.balance).toBe("0.3");
      expect(result.status).toBe("healthy");
      expect(result.reserveRatioBps).toBe(15_000);
    });

    it("computes the shortfall exactly for fractional amounts", () => {
      const result = evaluate({ balance: "0.1", nextPayrollObligation: "0.3" });

      expect(result.status).toBe("critical");
      expect(result.shortfall).toBe("0.2");
    });

    it("accepts decimal strings and numbers interchangeably", () => {
      expect(evaluate({ balance: "45000.00", nextPayrollObligation: "19500" })).toEqual(
        evaluate({ balance: 45_000, nextPayrollObligation: 19_500 }),
      );
    });

    it("rounds the target balance up so reaching it is always healthy", () => {
      const result = evaluate({ balance: 0, nextPayrollObligation: "0.0000001" });

      expect(result.targetBalance).toBe("0.0000002");
      expect(
        evaluate({ balance: result.targetBalance, nextPayrollObligation: "0.0000001" }).status,
      ).toBe("healthy");
    });

    it("caps very large ratios at a safe integer", () => {
      const result = evaluate({
        balance: Number.MAX_SAFE_INTEGER,
        nextPayrollObligation: "0.0000001",
      });

      expect(result.status).toBe("healthy");
      expect(Number.isSafeInteger(result.reserveRatioBps)).toBe(true);
      expect(Number.isSafeInteger(result.runsCovered)).toBe(true);
    });
  });

  describe("configuration", () => {
    it("applies a custom target reserve", () => {
      const balances = { balance: 15_000, nextPayrollObligation: 10_000 };

      expect(evaluate(balances, { ...CONFIG, targetReservePercent: 200 }).status).toBe("low");
      expect(evaluate(balances, { ...CONFIG, targetReservePercent: 100 }).status).toBe("healthy");
    });

    it.each([50, 0, -150, 150.5, Number.NaN, 1_000_000])(
      "falls back to the default target for an unusable value (%s)",
      (targetReservePercent) => {
        const result = evaluate({}, { ...CONFIG, targetReservePercent });

        expect(result.targetReservePercent).toBe(DEFAULT_TARGET_RESERVE_PERCENT);
      },
    );

    it("resolves the target from env-style strings", () => {
      expect(resolveTargetReservePercent("200")).toBe(200);
      expect(resolveTargetReservePercent(" 125 ")).toBe(125);
      expect(resolveTargetReservePercent(undefined)).toBe(DEFAULT_TARGET_RESERVE_PERCENT);
      expect(resolveTargetReservePercent("")).toBe(DEFAULT_TARGET_RESERVE_PERCENT);
      expect(resolveTargetReservePercent("1.5")).toBe(DEFAULT_TARGET_RESERVE_PERCENT);
      expect(resolveTargetReservePercent("99")).toBe(DEFAULT_TARGET_RESERVE_PERCENT);
      expect(resolveTargetReservePercent("abc")).toBe(DEFAULT_TARGET_RESERVE_PERCENT);
    });
  });

  describe("freshness", () => {
    it("is fresh inside the staleness window", () => {
      expect(evaluate({ lastUpdated: "2026-10-02T11:50:00Z" }).freshness).toBe("fresh");
    });

    it("is stale exactly at the staleness window", () => {
      expect(evaluate({ lastUpdated: "2026-10-02T11:45:00Z" }).freshness).toBe("stale");
    });

    it.each([null, undefined, "", "not-a-date"])(
      "is unknown when the timestamp is %s",
      (lastUpdated) => {
        const result = evaluate({ lastUpdated });

        expect(result.freshness).toBe("unknown");
        expect(result.lastUpdated).toBeNull();
      },
    );

    it("reports freshness on invalid and empty results too", () => {
      const stale = "2026-10-01T12:00:00Z";

      expect(
        evaluateTreasuryLiquidityReserve(snapshot({ balance: -1, lastUpdated: stale }), CONFIG, NOW)
          .freshness,
      ).toBe("stale");
      expect(
        evaluateTreasuryLiquidityReserve(
          snapshot({ nextPayrollObligation: 0, lastUpdated: stale }),
          CONFIG,
          NOW,
        ).freshness,
      ).toBe("stale");
    });
  });
});

describe("display helpers", () => {
  it("formats amounts with grouping and at least two decimals when fractional", () => {
    expect(formatTreasuryAmount("45000")).toBe("45,000");
    expect(formatTreasuryAmount("1234567.5")).toBe("1,234,567.50");
    expect(formatTreasuryAmount("0.0000001")).toBe("0.0000001");
    expect(formatTreasuryAmount(19_500)).toBe("19,500");
    expect(formatTreasuryAmount("nope")).toBe("—");
  });

  it("formats the reserve ratio as a whole percentage, rounded down", () => {
    expect(formatReserveRatioPercent(23_076)).toBe("230%");
    expect(formatReserveRatioPercent(14_999)).toBe("149%");
    expect(formatReserveRatioPercent(0)).toBe("0%");
  });
});
