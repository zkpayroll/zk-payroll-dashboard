import { describe, expect, it } from "vitest";
import {
  computeFundingSourceReadiness,
  type FundingSourceReadinessInputs,
} from "@/lib/treasury/fundingSourceReadiness";

const baseInputs: FundingSourceReadinessInputs = {
  treasuryBalance: 100_000,
  projectedPayroll: 50_000,
  walletBalance: 50,
  pendingFundingAmount: null,
  treasuryAddress: "GTREASURYADDRESS1234567890",
  isWalletConnected: true,
  walletPublicKey: "GWALLETADDRESS1234567890",
  companyAdmin: "GWALLETADDRESS1234567890",
  expectedNetwork: "TESTNET",
  currentNetwork: "TESTNET",
  bufferReserve: 25_000,
};

describe("computeFundingSourceReadiness", () => {
  it("returns ready when all sources are healthy", () => {
    const result = computeFundingSourceReadiness(baseInputs);

    expect(result.overall).toBe("ready");
    expect(result.canProceed).toBe(true);
    expect(result.shortfall).toBe(0);
    expect(result.totalAvailable).toBe(100_050);
    expect(result.totalRequired).toBe(50_000);
    expect(result.sources).toHaveLength(3);
    expect(result.sources[0].status).toBe("ready");
    expect(result.sources[1].status).toBe("ready");
  });

  it("returns blocked when treasury balance is insufficient", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      treasuryBalance: 30_000,
    });

    expect(result.overall).toBe("blocked");
    expect(result.canProceed).toBe(false);
    expect(result.shortfall).toBe(19_950);
    expect(result.sources[0].status).toBe("blocked");
    expect(result.sources[0].message).toMatch(/below the projected payroll/i);
  });

  it("returns blocked when no treasury address is configured", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      treasuryAddress: null,
    });

    expect(result.overall).toBe("blocked");
    expect(result.canProceed).toBe(false);
    expect(result.sources[0].status).toBe("blocked");
    expect(result.sources[0].message).toMatch(/no treasury address/i);
  });

  it("returns warning when treasury is below safety buffer", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      treasuryBalance: 70_000,
    });

    expect(result.overall).toBe("warning");
    expect(result.canProceed).toBe(true);
    expect(result.sources[0].status).toBe("warning");
    expect(result.sources[0].message).toMatch(/safety buffer/i);
  });

  it("returns blocked when wallet is not connected", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      isWalletConnected: false,
    });

    expect(result.overall).toBe("blocked");
    expect(result.canProceed).toBe(false);
    expect(result.sources[1].status).toBe("blocked");
    expect(result.sources[1].message).toMatch(/no wallet is connected/i);
  });

  it("returns blocked when wallet is on the wrong network", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      currentNetwork: "PUBLIC",
    });

    expect(result.overall).toBe("blocked");
    expect(result.canProceed).toBe(false);
    expect(result.sources[1].status).toBe("blocked");
    expect(result.sources[1].message).toMatch(/switch networks/i);
  });

  it("returns blocked when wallet does not match admin", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      walletPublicKey: "GOTHERWALLETADDRESS1234567890",
    });

    expect(result.overall).toBe("blocked");
    expect(result.canProceed).toBe(false);
    expect(result.sources[1].status).toBe("blocked");
    expect(result.sources[1].message).toMatch(/does not match/i);
  });

  it("returns warning when wallet has low XLM balance", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      walletBalance: 0.5,
    });

    expect(result.sources[1].status).toBe("warning");
    expect(result.sources[1].message).toMatch(/low XLM balance/i);
  });

  it("returns warning for pending funding transactions", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      pendingFundingAmount: 10_000,
    });

    expect(result.sources[2].status).toBe("warning");
    expect(result.sources[2].message).toMatch(/pending funding/i);
  });

  it("returns unknown for pending funding when none exists", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      pendingFundingAmount: null,
    });

    expect(result.sources[2].status).toBe("unknown");
  });

  it("returns blocked when multiple sources are blocked", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      treasuryBalance: 10_000,
      isWalletConnected: false,
    });

    expect(result.overall).toBe("blocked");
    expect(result.canProceed).toBe(false);
    expect(result.sources[0].status).toBe("blocked");
    expect(result.sources[1].status).toBe("blocked");
  });

  it("calculates shortfall correctly", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      treasuryBalance: 30_000,
      walletBalance: 5_000,
    });

    expect(result.shortfall).toBe(15_000);
    expect(result.totalAvailable).toBe(35_000);
    expect(result.totalRequired).toBe(50_000);
  });

  it("handles zero projected payroll", () => {
    const result = computeFundingSourceReadiness({
      ...baseInputs,
      projectedPayroll: 0,
    });

    expect(result.overall).toBe("ready");
    expect(result.canProceed).toBe(true);
    expect(result.shortfall).toBe(0);
  });
});
