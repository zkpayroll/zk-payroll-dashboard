import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AuditRetentionPolicySection } from "@/components/features/policy/AuditRetentionPolicySection";
import type { AuditRetentionPolicy, PolicyValidationIssue } from "@/types/policy";

const policy: AuditRetentionPolicy = {
  retentionPeriodDays: 365,
  immutableAuditLog: true,
  requireAuditorExportSignoff: true,
  detailedTelemetry: false,
};

function setup(days = 365, issues: PolicyValidationIssue[] = []) {
  const onChange = vi.fn();
  const result = render(
    <AuditRetentionPolicySection auditRetention={{ ...policy, retentionPeriodDays: days }} issues={issues} onChange={onChange} />,
  );
  return { onChange, ...result };
}

describe("retention policy update component (#920, #919, #917)", () => {
  it("explains retention boundaries, effects and immutable safeguards", () => {
    setup();
    expect(screen.getByText(/Choose 30–3650 whole days/)).toBeInTheDocument();
    expect(screen.getByText(/does not delete existing records automatically/)).toBeInTheDocument();
    expect(screen.getByText(/legal holds remain protected/)).toBeInTheDocument();
  });

  it("updates retention through preset and manual entry", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "1 Year" }));
    expect(onChange).toHaveBeenCalledWith({ retentionPeriodDays: 365 });
    fireEvent.change(screen.getByLabelText(/Audit Log Retention Period/), { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledWith({ retentionPeriodDays: 30 });
  });

  it("offers recovery to last valid value and recommended default", () => {
    const { onChange, rerender } = setup(180);
    rerender(<AuditRetentionPolicySection auditRetention={{ ...policy, retentionPeriodDays: 7 }} issues={[]} onChange={onChange} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/between 30 and 3650/);
    fireEvent.click(screen.getByRole("button", { name: /Restore last valid value/ }));
    expect(onChange).toHaveBeenCalledWith({ retentionPeriodDays: 180 });
    fireEvent.click(screen.getByRole("button", { name: /Use recommended 365 days/ }));
    expect(onChange).toHaveBeenCalledWith({ retentionPeriodDays: 365 });
  });

  it("flags fractional and out-of-range values without hiding policy issues", () => {
    const issue: PolicyValidationIssue = { id: "invalid", section: "auditRetention", severity: "error", title: "Invalid retention", message: "Fix the retention window" };
    setup(3650.5, [issue]);
    expect(screen.getByText(/Invalid retention/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/whole number/);
  });

  it("does not expose payroll amounts or employee information in recovery guidance", () => {
    const { container } = setup(-1);
    expect(container.textContent).not.toMatch(/salary amount|employee name|bank account/i);
  });
});
