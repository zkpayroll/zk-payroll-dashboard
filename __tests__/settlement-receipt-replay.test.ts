import { describe, expect, it } from "vitest";
import { normalizeSettlementReceiptReplayId, validateSettlementReceiptReplayId } from "@/lib/validation/settlementReceiptReplay";

describe("settlement receipt replay", () => {
  it("normalizes settlement receipt replay ID correctly", () => {
    expect(normalizeSettlementReceiptReplayId("  RCPT_replay_001 ")).toBe("rcpt_replay_001");
  });

  it("validates settlement receipt replay ID format", () => {
    const result = validateSettlementReceiptReplayId("RCPT_replay_001");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("rcpt_replay_001");
  });

  it("reports invalid format with actionable hint", () => {
    const result = validateSettlementReceiptReplayId("random-text");
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("Expected format");
  });

  it("reports missing settlement receipt replay ID", () => {
    const result = validateSettlementReceiptReplayId(null);
    expect(result.isValid).toBe(false);
    expect(result.message).toBe("Settlement receipt replay ID is missing.");
  });
});
