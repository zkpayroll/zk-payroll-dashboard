import { describe, expect, it } from "vitest";
import { analyzeTreasuryReplenishmentReadiness } from "@/lib/treasury/replenishmentReadiness";
import type {
  TreasuryReplenishmentEvaluatedResult,
  TreasuryReplenishmentInvalidResult,
  TreasuryReplenishmentPolicyInput,
  TreasuryReplenishmentReadinessResult,
  TreasuryReplenishmentSnapshot,
} from "@/types/treasury";

const BLOCK_POLICY: TreasuryReplenishmentPolicyInput = {
  minReservePercentage: 20,
  minReserveFixedAmount: 25000,
  replenishThresholdPercentage: 15,
  shortfallPolicy: "block",
};

function snapshot(
  overrides: Partial<TreasuryReplenishmentSnapshot> = {},
): TreasuryReplenishmentSnapshot {
  return {
    assetCode: "USDC",
    availableBalance: "45000",
    nextPayrollObligation: "19500",
    policy: BLOCK_POLICY,
    ...overrides,
  };
}

function evaluate(
  overrides: Partial<TreasuryReplenishmentSnapshot> = {},
): TreasuryReplenishmentEvaluatedResult {
  const result = analyzeTreasuryReplenishmentReadiness(snapshot(overrides));
  if (result.kind !== "evaluated") {
    throw new Error(`Expected an evaluated result, got ${result.kind}`);
  }
  return result;
}

function invalid(
  overrides: Partial<TreasuryReplenishmentSnapshot> = {},
): TreasuryReplenishmentInvalidResult {
  const result = analyzeTreasuryReplenishmentReadiness(snapshot(overrides));
  if (result.kind !== "invalid") {
    throw new Error(`Expected an invalid result, got ${result.kind}`);
  }
  return result;
}

describe("analyzeTreasuryReplenishmentReadiness", () => {
  describe("ready state", () => {
    it("is ready when the balance meets the policy reserve target", () => {
      const result = evaluate();

      expect(result.status).toBe("ready");
      expect(result.targetReserveAmount).toBe("25000");
      expect(result.replenishThresholdAmount).toBe("3750");
      expect(result.topUpAmount).toBe("0");
      expect(result.shortfall).toBe("0");
      expect(result.shouldReplenish).toBe(false);
      expect(result.payrollBlocked).toBe(false);
      expect(result.message).toContain(
        "Available balance meets the policy reserve target of 25,000 USDC.",
      );
    });

    it("is ready exactly at the target boundary", () => {
      const result = evaluate({ availableBalance: "25000" });

      expect(result.status).toBe("ready");
      expect(result.shouldReplenish).toBe(false);
    });

    it("uses the percentage target when it exceeds the fixed reserve", () => {
      const result = evaluate({
        availableBalance: "16000",
        nextPayrollObligation: "10000",
        policy: {
          ...BLOCK_POLICY,
          minReservePercentage: 150,
          minReserveFixedAmount: 0,
        },
      });

      expect(result.status).toBe("ready");
      expect(result.targetReserveAmount).toBe("15000");
    });
  });

  describe("watch state", () => {
    it("is watching when payroll is covered but the reserve target is missed", () => {
      const result = evaluate({ availableBalance: "24000" });

      expect(result.status).toBe("watch");
      expect(result.topUpAmount).toBe("1000");
      expect(result.shortfall).toBe("0");
      expect(result.shouldReplenish).toBe(true);
      expect(result.payrollBlocked).toBe(false);
      expect(result.message).toContain(
        "Balance covers payroll but is below the policy reserve target of 25,000 USDC.",
      );
      expect(result.message).toContain("Replenish 1,000 USDC");
    });
  });

  describe("replenish now state", () => {
    it("flags a shortfall when the balance cannot cover the next payroll run", () => {
      const result = evaluate({ availableBalance: "5000" });

      expect(result.status).toBe("replenish_now");
      expect(result.shortfall).toBe("14500");
      expect(result.topUpAmount).toBe("20000");
      expect(result.shouldReplenish).toBe(true);
      expect(result.payrollBlocked).toBe(true);
      expect(result.message).toContain("Available balance cannot cover the next payroll run.");
      expect(result.message).toContain("Replenish at least 14,500 USDC");
      expect(result.message).toContain("Payroll is blocked by policy");
    });

    it("respects a warn shortfall policy instead of blocking payroll", () => {
      const result = evaluate({
        availableBalance: "5000",
        policy: { ...BLOCK_POLICY, shortfallPolicy: "warn" },
      });

      expect(result.status).toBe("replenish_now");
      expect(result.payrollBlocked).toBe(false);
      expect(result.message).toContain("flags the shortfall as a warning");
    });

    it("respects a require-approval shortfall policy", () => {
      const result = evaluate({
        availableBalance: "5000",
        policy: { ...BLOCK_POLICY, shortfallPolicy: "require_approval" },
      });

      expect(result.payrollBlocked).toBe(false);
      expect(result.message).toContain("requires a shortfall approval");
    });

    it("flags a top-up when the balance falls below the replenishment threshold", () => {
      const result = evaluate({
        availableBalance: "1200",
        nextPayrollObligation: "1000",
        policy: {
          minReservePercentage: 20,
          minReserveFixedAmount: 10000,
          replenishThresholdPercentage: 15,
          shortfallPolicy: "block",
        },
      });

      expect(result.status).toBe("replenish_now");
      expect(result.shortfall).toBe("0");
      expect(result.topUpAmount).toBe("8800");
      expect(result.payrollBlocked).toBe(false);
      expect(result.message).toContain(
        "below the replenishment threshold of 1,500 USDC",
      );
    });
  });

  describe("obligation handling", () => {
    it("treats a missing obligation as zero and falls back to the fixed reserve", () => {
      const result = evaluate({ nextPayrollObligation: null });

      expect(result.nextPayrollObligation).toBe("0");
      expect(result.targetReserveAmount).toBe("25000");
      expect(result.status).toBe("ready");
    });

    it("compares fractional balances without floating point drift", () => {
      const result = evaluate({
        availableBalance: "25000.0000001",
        nextPayrollObligation: "10000",
      });

      expect(result.status).toBe("ready");
      expect(result.balance).toBe("25000.0000001");
    });
  });

  describe("invalid inputs", () => {
    it("rejects a missing balance", () => {
      const result = invalid({ availableBalance: null });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].field).toBe("availableBalance");
      expect(result.issues[0].message).toContain("treasury balance is unavailable");
    });

    it("rejects a negative balance", () => {
      const result = invalid({ availableBalance: "-5" });

      expect(result.issues[0].field).toBe("availableBalance");
      expect(result.issues[0].message).toContain("negative");
    });

    it("rejects a balance with more precision than Stellar assets support", () => {
      const result = invalid({ availableBalance: "1.12345678" });

      expect(result.issues[0].message).toContain("more than 7 decimal places");
    });

    it("rejects a non-numeric balance", () => {
      const result = invalid({ availableBalance: "plenty" });

      expect(result.issues[0].message).toContain("not a valid amount");
    });

    it("rejects a balance that is too large to evaluate safely", () => {
      const result = invalid({ availableBalance: Number.MAX_SAFE_INTEGER + 10 });

      expect(result.issues[0].message).toContain("too large");
    });

    it("rejects a missing reserve policy", () => {
      const result = invalid({ policy: null });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].field).toBe("reservePolicy");
      expect(result.issues[0].message).toContain("reserve policy is unavailable");
    });

    it("rejects a reserve percentage outside its allowed range", () => {
      const result = invalid({
        policy: { ...BLOCK_POLICY, minReservePercentage: -1 },
      });

      expect(result.issues[0].field).toBe("reservePolicy");
      expect(result.issues[0].message).toContain("must be a number between 0 and 1000");
    });

    it("rejects a replenish threshold above 100 percent", () => {
      const result = invalid({
        policy: { ...BLOCK_POLICY, replenishThresholdPercentage: 150 },
      });

      expect(result.issues[0].message).toContain("percentage between 0 and 100");
    });

    it("rejects an unusable fixed reserve amount", () => {
      const result = invalid({
        policy: {
          ...BLOCK_POLICY,
          minReserveFixedAmount: "not-a-number" as unknown as number,
        },
      });

      expect(result.issues[0].field).toBe("reservePolicy");
      expect(result.issues[0].message).toContain("minimum fixed reserve is unusable");
    });

    it("rejects an invalid obligation", () => {
      const result = invalid({ nextPayrollObligation: "-100" });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].field).toBe("nextPayrollObligation");
      expect(result.issues[0].message).toContain("next payroll amount is negative");
    });
  });

  describe("asset label fallback", () => {
    it("falls back to a generic asset label when none is provided", () => {
      const result = analyzeTreasuryReplenishmentReadiness(
        snapshot({ assetCode: "  " }),
      );

      expect(result.assetCode).toBe("ASSET");
      if (result.kind !== "evaluated") {
        throw new Error(`Expected an evaluated result, got ${result.kind}`);
      }
      expect(result.message).toContain("25,000 ASSET");
    });
  });

  it("never throws on a partially populated snapshot", () => {
    const result: TreasuryReplenishmentReadinessResult =
      analyzeTreasuryReplenishmentReadiness({} as TreasuryReplenishmentSnapshot);

    expect(result.kind).toBe("invalid");
  });
});
