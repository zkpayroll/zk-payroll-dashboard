import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import PeriodCloseDashboard from "@/components/features/reconciliation/PeriodCloseDashboard";
import { usePeriodCloseStore } from "@/stores/periodClose";
import type { PayrollRun } from "@/types/models";

function makeRun(overrides: Partial<PayrollRun> = {}): PayrollRun {
  return {
    id: "tx_test",
    status: "verified",
    approvalStatus: "approved",
    timestamp: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    totalAmount: 10000,
    employeeCount: 5,
    employeeIds: ["emp_1"],
    ...overrides,
  } as PayrollRun;
}

describe("PeriodCloseDashboard", () => {
  beforeEach(() => {
    usePeriodCloseStore.setState({ closedPayrollRunIds: [] });
  });

  it("shows an empty state when there are no payroll periods", () => {
    render(<PeriodCloseDashboard runs={[]} />);
    expect(screen.getByText("No payroll periods to reconcile")).toBeInTheDocument();
  });

  it("shows a blocked period (tx_003 has an unresolved hold and reservation) as not closable", () => {
    render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_003" })]} />);

    const card = screen.getByTestId("period-close-card-tx_003");
    expect(within(card).getByText("Resolve blockers to close")).toBeDisabled();
    expect(within(card).getAllByText("Blocked").length).toBeGreaterThan(0);
  });

  it("shows a ready period (tx_001 has no blockers) as closable", () => {
    render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

    const card = screen.getByTestId("period-close-card-tx_001");
    expect(within(card).getByRole("button", { name: /close period/i })).not.toBeDisabled();
  });

  it("closes a ready period and shows the closed state", () => {
    render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

    const card = screen.getByTestId("period-close-card-tx_001");
    fireEvent.click(within(card).getByRole("button", { name: /close period/i }));

    expect(within(card).getByText("Closed")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /close period/i })).not.toBeInTheDocument();
  });

  it("does not render a close button that could bypass a blocked checklist via a stale click", () => {
    render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_003" })]} />);

    const card = screen.getByTestId("period-close-card-tx_003");
    fireEvent.click(within(card).getByText("Resolve blockers to close"));

    // The period must remain open — clicking a disabled button is a no-op.
    expect(within(card).queryByText("Closed")).not.toBeInTheDocument();
  });
});
