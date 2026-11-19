import { describe, expect, it } from "vitest";
import { normalizePayrollRunId, validatePayrollRunId } from "@/lib/validation/payrollRun";

describe("payroll run identifiers", () => {
  it("normalizes payroll run ID correctly", () => {
    expect(normalizePayrollRunId("  RUN_001 ")).toBe("run_001");
  });

  it("validates payroll run ID format", () => {
    const result = validatePayrollRunId("RUN_001");
    expect(result.isValid).toBe(true);
    expect(result.normalized).toBe("run_001");
  });

  it("reports invalid format with actionable hint", () => {
    const result = validatePayrollRunId("invalid-run");
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("Expected format");
  });
});
