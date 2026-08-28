import { describe, it, expect } from "vitest";
import { validateApproverThreshold } from "@/lib/validation/approverThreshold";

describe("validateApproverThreshold", () => {
  it("accepts a valid increased threshold", () => {
    const result = validateApproverThreshold(3, 2);
    expect(result.isValid).toBe(true);
  });

  it("accepts a valid decreased threshold", () => {
    const result = validateApproverThreshold(1, 2);
    expect(result.isValid).toBe(true);
  });

  it("rejects zero", () => {
    const result = validateApproverThreshold(0, 2);
    expect(result.isValid).toBe(false);
  });

  it("rejects a negative number", () => {
    const result = validateApproverThreshold(-1, 2);
    expect(result.isValid).toBe(false);
  });

  it("rejects a non-integer", () => {
    const result = validateApproverThreshold(1.5, 2);
    expect(result.isValid).toBe(false);
  });

  it("rejects a value above the reasonable ceiling", () => {
    const result = validateApproverThreshold(21, 2);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("cannot exceed");
  });

  it("accepts a value at the reasonable ceiling", () => {
    const result = validateApproverThreshold(20, 2);
    expect(result.isValid).toBe(true);
  });

  it("rejects proposing the same value as the current policy", () => {
    const result = validateApproverThreshold(2, 2);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("no change");
  });
});
