import { describe, expect, it } from "vitest";
import {
  validatePayrollGroupEffectiveDate,
  type PayrollGroupEffectiveDateInput,
} from "./payrollGroupEffectiveDateValidation";

const NOW = "2026-10-21T00:00:00Z";

const baseInput: PayrollGroupEffectiveDateInput = { now: NOW };

describe("validatePayrollGroupEffectiveDate", () => {
  it("accepts a future effective date with no constraints", () => {
    const result = validatePayrollGroupEffectiveDate({
      ...baseInput,
      proposedEffectiveDate: "2026-11-01",
    });
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("rejects a malformed effective date", () => {
    const result = validatePayrollGroupEffectiveDate({
      ...baseInput,
      proposedEffectiveDate: "not-a-date",
    });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("not a valid date");
  });

  it("rejects an effective date that is not in the future", () => {
    const result = validatePayrollGroupEffectiveDate({
      ...baseInput,
      proposedEffectiveDate: "2026-10-20",
    });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("must be in the future");
  });

  it("rejects an effective date equal to now (boundary)", () => {
    const result = validatePayrollGroupEffectiveDate({
      ...baseInput,
      proposedEffectiveDate: "2026-10-21",
    });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("must be in the future");
  });

  it("rejects an effective date before the current pay group's effective date", () => {
    const result = validatePayrollGroupEffectiveDate({
      ...baseInput,
      proposedEffectiveDate: "2026-10-25",
      currentPayGroupEffectiveDate: "2026-11-01",
    });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("after the current pay group's effective date");
  });

  it("rejects an effective date within an active payroll run period", () => {
    const result = validatePayrollGroupEffectiveDate({
      ...baseInput,
      proposedEffectiveDate: "2026-11-10",
      activeRunPeriodStart: "2026-11-01",
      activeRunPeriodEnd: "2026-11-15",
    });
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("active payroll run period");
  });

  it("accepts an effective date exactly one day after an active run period ends (edge case)", () => {
    const result = validatePayrollGroupEffectiveDate({
      ...baseInput,
      proposedEffectiveDate: "2026-11-16",
      activeRunPeriodStart: "2026-11-01",
      activeRunPeriodEnd: "2026-11-15",
    });
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });
});
