import { describe, it, expect } from "vitest";
import { validateReserveRelease } from "@/lib/treasury/reserveReleaseValidation";
import { useTreasuryStore, type TreasuryBalance, type PayrollObligation } from "@/stores/treasury";

const DEFAULT_BALANCE: TreasuryBalance = {
  assetCode: "USDC",
  available: 45_000,
  reserved: 15_000,
  projected: 19_500,
};

const DEFAULT_OBLIGATION: PayrollObligation = {
  id: "obl_1",
  name: "April Payroll",
  amount: 10_000,
  assetCode: "USDC",
  scheduledDate: "2025-04-30T00:00:00Z",
  lockedAt: "2025-04-15T10:00:00Z",
};

describe("validateReserveRelease", () => {
  it("returns safe when release amount is valid", () => {
    const result = validateReserveRelease(DEFAULT_BALANCE, 5_000);
    expect(result.riskLevel).toBe("safe");
    expect(result.details.violatesReserved).toBe(false);
    expect(result.message).toMatch(/is valid/i);
  });

  it("returns blocked when release amount is zero or negative", () => {
    const resultZero = validateReserveRelease(DEFAULT_BALANCE, 0);
    expect(resultZero.riskLevel).toBe("blocked");
    expect(resultZero.details.isZeroOrNegative).toBe(true);

    const resultNeg = validateReserveRelease(DEFAULT_BALANCE, -100);
    expect(resultNeg.riskLevel).toBe("blocked");
    expect(resultNeg.details.isZeroOrNegative).toBe(true);
  });

  it("returns blocked when release amount exceeds total reserved balance", () => {
    const result = validateReserveRelease(DEFAULT_BALANCE, 20_000);
    expect(result.riskLevel).toBe("blocked");
    expect(result.details.violatesReserved).toBe(true);
    expect(result.message).toMatch(/exceeds the total reserved balance/i);
  });

  it("returns blocked when release amount exceeds obligation amount", () => {
    const result = validateReserveRelease(DEFAULT_BALANCE, 12_000, DEFAULT_OBLIGATION);
    expect(result.riskLevel).toBe("blocked");
    expect(result.details.violatesObligation).toBe(true);
    expect(result.message).toMatch(/exceeds the locked obligation amount/i);
  });

  it("returns safe when release amount equals obligation amount", () => {
    const result = validateReserveRelease(DEFAULT_BALANCE, 10_000, DEFAULT_OBLIGATION);
    expect(result.riskLevel).toBe("safe");
    expect(result.details.violatesObligation).toBe(false);
    expect(result.details.violatesReserved).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "blocks non-finite release amounts (%s)",
    (amount) => {
      const result = validateReserveRelease(DEFAULT_BALANCE, amount);

      expect(result.riskLevel).toBe("blocked");
      expect(result.details.isNotFinite).toBe(true);
      expect(result.message).toMatch(/finite release amount/i);
    },
  );

  it("blocks invalid treasury balances rather than allowing unsafe arithmetic", () => {
    const result = validateReserveRelease(
      { ...DEFAULT_BALANCE, available: Number.NaN },
      1,
    );

    expect(result.riskLevel).toBe("blocked");
    expect(result.details.hasInvalidBalance).toBe(true);
    expect(result.message).toMatch(/balance is invalid/i);
  });

  it("blocks releases against an obligation for another asset", () => {
    const result = validateReserveRelease(DEFAULT_BALANCE, 1_000, {
      ...DEFAULT_OBLIGATION,
      assetCode: "XLM",
    });

    expect(result.riskLevel).toBe("blocked");
    expect(result.details.violatesAsset).toBe(true);
    expect(result.message).toMatch(/same asset/i);
  });

  it("allows a release exactly equal to the reserved balance", () => {
    const result = validateReserveRelease(DEFAULT_BALANCE, DEFAULT_BALANCE.reserved);

    expect(result.riskLevel).toBe("safe");
    expect(result.details.violatesReserved).toBe(false);
  });
});

describe("treasury store reserve releases", () => {
  it("updates balances and retains the remaining obligation after a partial release", () => {
    useTreasuryStore.setState({
      balances: { USDC: { ...DEFAULT_BALANCE } },
      obligations: [{ ...DEFAULT_OBLIGATION, amount: 10_000 }],
      lastUpdated: null,
    });

    useTreasuryStore.getState().releaseReservation("USDC", 4_000, "obl_1");

    const state = useTreasuryStore.getState();
    expect(state.balances.USDC.available).toBe(49_000);
    expect(state.balances.USDC.reserved).toBe(11_000);
    expect(state.obligations).toHaveLength(1);
    expect(state.obligations[0].amount).toBe(6_000);
    expect(state.lastUpdated).not.toBeNull();
  });

  it("does not mutate treasury state when the release exceeds the obligation", () => {
    useTreasuryStore.setState({
      balances: { USDC: { ...DEFAULT_BALANCE } },
      obligations: [DEFAULT_OBLIGATION],
      lastUpdated: null,
    });

    expect(() =>
      useTreasuryStore.getState().releaseReservation("USDC", 12_000, "obl_1"),
    ).toThrow(/exceeds the locked obligation amount/i);

    const state = useTreasuryStore.getState();
    expect(state.balances.USDC).toEqual(DEFAULT_BALANCE);
    expect(state.obligations).toEqual([DEFAULT_OBLIGATION]);
    expect(state.lastUpdated).toBeNull();
  });

  it("rejects stale obligation identifiers with a recovery message", () => {
    useTreasuryStore.setState({
      balances: { USDC: { ...DEFAULT_BALANCE } },
      obligations: [],
      lastUpdated: null,
    });

    expect(() =>
      useTreasuryStore.getState().releaseReservation("USDC", 1_000, "missing"),
    ).toThrow(/obligation could not be found uniquely.*refresh the treasury/i);
  });
});
