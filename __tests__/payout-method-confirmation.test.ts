import { describe, expect, it } from "vitest";
import { validatePayoutMethodConfirmation } from "@/src/payroll/payoutMethodConfirmation";

const wallet = "G" + "A".repeat(55);

describe("validatePayoutMethodConfirmation", () => {
  it("requires explicit confirmation for a new valid destination", () => {
    expect(validatePayoutMethodConfirmation({ employeeId: "emp-1", proposedWallet: wallet, confirmed: true })).toEqual({ isValid: true, error: null });
  });

  it("rejects an unchanged destination", () => {
    const result = validatePayoutMethodConfirmation({ employeeId: "emp-1", currentWallet: wallet, proposedWallet: wallet, confirmed: true });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("different");
  });

  it("rejects an unconfirmed destination change", () => {
    const result = validatePayoutMethodConfirmation({ employeeId: "emp-1", proposedWallet: wallet, confirmed: false });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Confirm");
  });
});