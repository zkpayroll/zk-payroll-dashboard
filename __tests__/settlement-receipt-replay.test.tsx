import { describe, expect, it } from "vitest";
import { normalizeSettlementReceiptId, validateSettlementReceiptId } from "@/lib/validation/settlementReceipt";

describe("settlement receipt replay", () => {
  it("normalizes settlement receipt ID correctly", () => {
    expect(normalizeSettlementReceiptId("  RCPT_settlement_001 ")).toBe("rcpt_settlement_001");
  });

  it("validates settlement receipt ID format", () => {
    const result = validateSettlementReceiptId("RCPT_settlement_001");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("rcpt_settlement_001");
  });

  it("reports invalid format with actionable hint", () => {
    const result = validateSettlementReceiptId("random-text");
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("Expected format");
  });
});
