import { describe, expect, it } from "vitest";
import { validatePayrollVariance } from "@/lib/validation/payrollVariance";

describe("validatePayrollVariance", () => {
  it("accepts totals within the configured threshold", () => {
    expect(validatePayrollVariance(1000, 1004, 5)).toEqual({
      isValid: true,
      variance: 4,
      message: null,
    });
  });

  it("rejects totals outside the configured threshold", () => {
    const result = validatePayrollVariance(1000, 1010, 5);
    expect(result.isValid).toBe(false);
    expect(result.variance).toBe(10);
    expect(result.message).toContain("exceeds");
  });

  it("rejects negative totals and thresholds", () => {
    const result = validatePayrollVariance(-1, 1000, 5);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("cannot be negative");
  });
});