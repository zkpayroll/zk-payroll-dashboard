import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { canCancelPayroll, getCancellationRestrictionReason } from "@/lib/auth/roles";
import { PayrollCancellationPanel } from "@/components/features/payroll/PayrollCancellationPanel";
import { CancelPayrollDialog } from "@/components/features/payroll/CancelPayrollDialog";
import type { PayrollRun } from "@/types/models";

const mockCancelledRun: PayrollRun = {
  id: "run_001",
  period: "2025-06",
  status: "cancelled",
  totalAmount: 10000,
  employeeCount: 2,
  createdAt: "2025-06-01T00:00:00Z",
  cancellationReason: "manual_request",
  cancellationDetail: "Cancelled by operator request",
  cancelledBy: "op_01",
  cancelledAt: "2025-06-01T01:00:00Z",
};

describe("canCancelPayroll permission helpers", () => {
  it("allows admin and operator roles to cancel payroll runs", () => {
    expect(canCancelPayroll("admin")).toBe(true);
    expect(canCancelPayroll("operator")).toBe(true);
  });

  it("denies auditor role and returns explanatory restriction reason", () => {
    expect(canCancelPayroll("auditor")).toBe(false);
    expect(getCancellationRestrictionReason("auditor")).toMatch(/restricted to Admin and Operator/i);
  });
});

describe("PayrollCancellationPanel role tests", () => {
  it("renders panel with role badge when role is provided", () => {
    render(
      <PayrollCancellationPanel
        run={mockCancelledRun}
        userRole="admin"
      />
    );

    expect(screen.getByTestId("role-cancellation-badge")).toBeInTheDocument();
    expect(screen.getByText(/Role: admin \(Cancel Authorized\)/i)).toBeInTheDocument();
  });

  it("displays restriction notice for read-only auditor role", () => {
    render(
      <PayrollCancellationPanel
        run={mockCancelledRun}
        userRole="auditor"
      />
    );

    expect(screen.getByTestId("cancellation-role-restriction-banner")).toBeInTheDocument();
    expect(screen.getByText(/restricted to Admin and Operator/i)).toBeInTheDocument();
  });
});

describe("CancelPayrollDialog role tests", () => {
  it("disables cancellation controls when user role is auditor", () => {
    render(
      <CancelPayrollDialog
        isOpen={true}
        payroll={mockCancelledRun}
        userRole="auditor"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByTestId("role-cancellation-restriction-alert")).toBeInTheDocument();
    const cancelBtn = screen.getByRole("button", { name: "Cancel Payroll" });
    expect(cancelBtn).toBeDisabled();
  });
});
