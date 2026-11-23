import { describe, expect, it } from "vitest";
import { normalizeSettlementReceiptId, validateSettlementReceiptId } from "@/lib/validation/settlementReceipt";

describe("settlement receipt validation", () => {
  it("accepts and normalizes a valid receipt ID", () => {
    expect(normalizeSettlementReceiptId("  RCPT_settlement_001 ")).toBe("rcpt_settlement_001");
    expect(validateSettlementReceiptId("RCPT_settlement_001")).toEqual({
      isValid: true,
      normalized: "rcpt_settlement_001",
      message: null,
    });
  });

  it("reports missing receipt IDs clearly", () => {
    const result = validateSettlementReceiptId(null);
    expect(result.isValid).toBe(false);
    expect(result.message).toBe("Settlement receipt ID is missing.");
  });

  it("reports malformed receipt IDs with an actionable format hint", () => {
    const result = validateSettlementReceiptId("receipt/with spaces");
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("Expected format: rcpt_<identifier>");
  });
});
