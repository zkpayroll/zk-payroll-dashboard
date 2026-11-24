import { describe, expect, it } from "vitest";
import { checkTreasuryReservation } from "@/lib/treasury/reservations";
import type { TreasuryBalance } from "@/stores/treasury";

describe("checkTreasuryReservation - asset code explanation and validation (#843)", () => {
  const balanceUSDC: TreasuryBalance = {
    assetCode: "USDC",
    available: 50_000,
    reserved: 10_000,
    projected: 20_000,
  };

  it("succeeds when asset code is known and supported with sufficient available balance", () => {
    const result = checkTreasuryReservation(balanceUSDC, "USDC", 15_000);

    expect(result.ok).toBe(true);
    expect(result.assetCode).toBe("USDC");
    expect(result.requestedAmount).toBe(15_000);
    expect(result.availableBalance).toBe(50_000);
    expect(result.reason).toBeUndefined();
    expect(result.errorCode).toBeUndefined();
  });

  it("rejects unknown or unsupported asset codes before checking balance or reserving", () => {
    const result = checkTreasuryReservation(balanceUSDC, "UNKNOWN_TOKEN", 15_000);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("UNKNOWN_ASSET_CODE");
    expect(result.reason).toMatch(/Unknown or unsupported asset code "UNKNOWN_TOKEN"/i);
    expect(result.reason).toMatch(/Treasury reservation requires a supported payroll asset/i);
    expect(result.reason).toMatch(/USDC, XLM, EURC/i);
    // Privacy: never leaks private payroll data or secrets
    expect(result.reason).not.toMatch(/employee|salary/i);
  });

  it("handles boundary cases: case-insensitivity, whitespace trimming, and empty/missing codes", () => {
    // Lowercase with whitespace should normalize and match supported asset
    const trimmedResult = checkTreasuryReservation(balanceUSDC, "  usdc  ", 10_000);
    expect(trimmedResult.ok).toBe(true);

    // Empty string asset code
    const emptyResult = checkTreasuryReservation(balanceUSDC, "", 10_000);
    expect(emptyResult.ok).toBe(false);
    expect(emptyResult.errorCode).toBe("UNKNOWN_ASSET_CODE");
    expect(emptyResult.reason).toMatch(/Unknown or unsupported asset code/i);

    // Non-string or null asset code
    const nullResult = checkTreasuryReservation(
      balanceUSDC,
      null as unknown as string,
      10_000,
    );
    expect(nullResult.ok).toBe(false);
    expect(nullResult.errorCode).toBe("UNKNOWN_ASSET_CODE");
  });

  it("preserves standard checks for supported assets (unconfigured balance, invalid amount, overdraft)", () => {
    // No balance configured
    const noBal = checkTreasuryReservation(undefined, "XLM", 1_000);
    expect(noBal.ok).toBe(false);
    expect(noBal.errorCode).toBe("NO_BALANCE");
    expect(noBal.reason).toMatch(/No treasury balance is configured for XLM/i);

    // Invalid amount
    const invalidAmt = checkTreasuryReservation(balanceUSDC, "USDC", -50);
    expect(invalidAmt.ok).toBe(false);
    expect(invalidAmt.errorCode).toBe("INVALID_AMOUNT");

    // Overdraft beyond available
    const overdraft = checkTreasuryReservation(balanceUSDC, "USDC", 999_999);
    expect(overdraft.ok).toBe(false);
    expect(overdraft.errorCode).toBe("INSUFFICIENT_BALANCE");
  });
});
