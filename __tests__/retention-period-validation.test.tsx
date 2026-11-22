import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { compilePayrollPolicy } from "@/lib/sdk/payrollPolicyCompiler";
import { validateRetentionPeriodDays } from "@/lib/payroll/retentionPeriodValidation";
import { AuditRetentionPolicySection } from "@/components/features/policy/AuditRetentionPolicySection";
import { usePayrollPolicyStore, DEFAULT_PAYROLL_POLICY } from "@/stores/payrollPolicy";
import type { AuditRetentionPolicy, PayrollPolicy } from "@/types/policy";

const auditPolicy: AuditRetentionPolicy = {
  retentionPeriodDays: 365,
  immutableAuditLog: true,
  requireAuditorExportSignoff: true,
  detailedTelemetry: false,
};

function policyWithRetention(days: number): PayrollPolicy {
  const policy: PayrollPolicy = JSON.parse(JSON.stringify(DEFAULT_PAYROLL_POLICY));
  policy.auditRetention.retentionPeriodDays = days;
  return policy;
}

function retentionErrorIds(days: number): string[] {
  return compilePayrollPolicy(policyWithRetention(days))
    .issues.filter((i) => i.section === "auditRetention" && i.severity === "error")
    .map((i) => i.id);
}

describe("retention period validation rules (#918)", () => {
  it("accepts the inclusive boundaries 30 and 3650 days", () => {
    expect(validateRetentionPeriodDays(30)).toEqual({ valid: true });
    expect(validateRetentionPeriodDays(3650)).toEqual({ valid: true });
  });

  it("rejects values just outside the range with actionable reasons", () => {
    const low = validateRetentionPeriodDays(29);
    expect(low.valid).toBe(false);
    if (!low.valid) expect(low.reason).toMatch(/at least 30 days/);

    const high = validateRetentionPeriodDays(3651);
    expect(high.valid).toBe(false);
    if (!high.valid) expect(high.reason).toMatch(/3650 days/);
  });

  it("rejects fractional, non-finite and non-number values", () => {
    for (const value of [365.5, 30.000001, NaN, Infinity, -Infinity, "365", null, undefined]) {
      const result = validateRetentionPeriodDays(value);
      expect(result.valid).toBe(false);
    }
    const fractional = validateRetentionPeriodDays(365.5);
    if (!fractional.valid) expect(fractional.reason).toMatch(/whole number/);
  });

  it("never echoes the entered value in its reason", () => {
    for (const value of [7, 3651, 365.5, -42]) {
      const result = validateRetentionPeriodDays(value);
      if (!result.valid) {
        expect(result.reason).not.toContain(String(value));
      }
    }
  });
});

describe("policy compiler retention checks (#918)", () => {
  it("passes whole-day values at the boundaries", () => {
    expect(retentionErrorIds(30)).toEqual([]);
    expect(retentionErrorIds(3650)).toEqual([]);
  });

  it("blocks fractional and NaN retention periods", () => {
    expect(retentionErrorIds(30.5)).toContain("audit-retention-not-whole");
    expect(retentionErrorIds(NaN)).toContain("audit-retention-not-whole");
    expect(compilePayrollPolicy(policyWithRetention(30.5)).isValid).toBe(false);
  });

  it("keeps the existing range errors at 29 and 3651 days", () => {
    expect(retentionErrorIds(29)).toContain("audit-retention-min");
    expect(retentionErrorIds(3651)).toContain("audit-retention-max");
  });
});

describe("retention period save blocking (#918)", () => {
  beforeEach(() => {
    usePayrollPolicyStore.setState({ policy: policyWithRetention(365), saveError: null, saveSuccess: false });
  });

  it("refuses to save a fractional retention period and shows a generic error", async () => {
    usePayrollPolicyStore.getState().updateAuditRetention({ retentionPeriodDays: 30.5 });
    const saved = await usePayrollPolicyStore.getState().savePolicy("Test Admin");
    expect(saved).toBe(false);
    const { saveError, saveSuccess } = usePayrollPolicyStore.getState();
    expect(saveSuccess).toBe(false);
    expect(saveError).toMatch(/critical validation error/);
    expect(saveError).not.toContain("30.5");
  });
});

describe("AuditRetentionPolicySection validation messages (#918)", () => {
  function renderWith(days: number) {
    const onChange = vi.fn();
    render(<AuditRetentionPolicySection auditRetention={{ ...auditPolicy, retentionPeriodDays: days }} issues={[]} onChange={onChange} />);
    return { onChange };
  }

  it("shows no alert at the 30 and 3650 day boundaries", () => {
    const { unmount } = render(<AuditRetentionPolicySection auditRetention={{ ...auditPolicy, retentionPeriodDays: 30 }} issues={[]} onChange={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();
    renderWith(3650);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the whole-number reason for a fractional entry", () => {
    renderWith(365.5);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Use a whole number of days/);
    expect(alert.textContent).not.toContain("365.5");
  });

  it("restores the last valid value after an out-of-range entry", () => {
    const onChange = vi.fn();
    render(<AuditRetentionPolicySection auditRetention={{ ...auditPolicy, retentionPeriodDays: 3651 }} issues={[]} onChange={onChange} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/3650 days/);
    fireEvent.click(screen.getByRole("button", { name: /Restore last valid value \(365 days\)/ }));
    expect(onChange).toHaveBeenCalledWith({ retentionPeriodDays: 365 });
  });
});
