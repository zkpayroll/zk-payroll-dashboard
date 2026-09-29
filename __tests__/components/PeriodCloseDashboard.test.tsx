import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
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

const VALID_REOPEN_REASON = "Missing employee adjustment discovered during post-close review.";

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

  it("closes a ready period and shows the closed state after confirmation", async () => {
    render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

    const card = screen.getByTestId("period-close-card-tx_001");
    fireEvent.click(within(card).getByRole("button", { name: /close period/i }));

    // Confirmation dialog is displayed
    expect(screen.getByTestId("period-finalization-dialog")).toBeInTheDocument();

    // Confirm finalization
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm & finalize period/i }));

    await waitFor(() => {
      expect(within(card).getByText("Closed")).toBeInTheDocument();
      expect(within(card).queryByRole("button", { name: /close period/i })).not.toBeInTheDocument();
    });
  });

  it("keeps period open if confirmation dialog is canceled", () => {
    render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

    const card = screen.getByTestId("period-close-card-tx_001");
    fireEvent.click(within(card).getByRole("button", { name: /close period/i }));

    expect(screen.getByTestId("period-finalization-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cancel and keep open/i }));

    expect(screen.queryByTestId("period-finalization-dialog")).not.toBeInTheDocument();
    expect(within(card).queryByText("Closed")).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /close period/i })).toBeInTheDocument();
  });

  it("does not render a close button that could bypass a blocked checklist via a stale click", () => {
    render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_003" })]} />);

    const card = screen.getByTestId("period-close-card-tx_003");
    fireEvent.click(within(card).getByText("Resolve blockers to close"));

    // The period must remain open — clicking a disabled button is a no-op.
    expect(within(card).queryByText("Closed")).not.toBeInTheDocument();
  });

  describe("reopen flow", () => {
    beforeEach(() => {
      usePeriodCloseStore.setState({ closedPayrollRunIds: ["tx_001"] });
    });

    it("shows a reopen button and Closed badge for a closed period", () => {
      render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

      const card = screen.getByTestId("period-close-card-tx_001");
      expect(within(card).getByText("Closed")).toBeInTheDocument();
      expect(within(card).getByTestId("reopen-btn-tx_001")).toBeInTheDocument();
      expect(within(card).queryByRole("button", { name: /close period/i })).not.toBeInTheDocument();
    });

    it("opens the reopen confirmation dialog when Reopen button is clicked", () => {
      render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

      const card = screen.getByTestId("period-close-card-tx_001");
      fireEvent.click(within(card).getByTestId("reopen-btn-tx_001"));

      expect(screen.getByTestId("period-reopen-dialog")).toBeInTheDocument();
      expect(screen.getByText("Reopen Closed Payroll Period")).toBeInTheDocument();
    });

    it("reopens a closed period after valid reason and acknowledgement", async () => {
      render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

      const card = screen.getByTestId("period-close-card-tx_001");
      fireEvent.click(within(card).getByTestId("reopen-btn-tx_001"));

      // Fill reason and acknowledge
      fireEvent.change(screen.getByRole("textbox", { name: /reopen reason/i }), {
        target: { value: VALID_REOPEN_REASON },
      });
      fireEvent.click(screen.getByRole("checkbox", { name: /I understand that reopening/i }));
      fireEvent.click(screen.getByRole("button", { name: /Confirm reopen/i }));

      await waitFor(() => {
        expect(within(card).queryByText("Closed")).not.toBeInTheDocument();
        expect(within(card).getByRole("button", { name: /close period/i })).toBeInTheDocument();
        expect(usePeriodCloseStore.getState().isClosed("tx_001")).toBe(false);
      });
    });

    it("keeps period closed if reopen dialog is canceled", () => {
      render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

      const card = screen.getByTestId("period-close-card-tx_001");
      fireEvent.click(within(card).getByTestId("reopen-btn-tx_001"));

      expect(screen.getByTestId("period-reopen-dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Keep period closed/i }));

      expect(screen.queryByTestId("period-reopen-dialog")).not.toBeInTheDocument();
      expect(within(card).getByText("Closed")).toBeInTheDocument();
      expect(usePeriodCloseStore.getState().isClosed("tx_001")).toBe(true);
    });

    it("blocks reopen with a reason that is too short", () => {
      render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

      const card = screen.getByTestId("period-close-card-tx_001");
      fireEvent.click(within(card).getByTestId("reopen-btn-tx_001"));

      fireEvent.click(screen.getByRole("checkbox", { name: /I understand that reopening/i }));
      fireEvent.change(screen.getByRole("textbox", { name: /reopen reason/i }), {
        target: { value: "short" },
      });

      const confirmBtn = screen.getByRole("button", { name: /Confirm reopen/i });
      expect(confirmBtn).toBeDisabled();
      expect(screen.getByText(/5\/500 characters — minimum 10\./)).toBeInTheDocument();
      expect(usePeriodCloseStore.getState().isClosed("tx_001")).toBe(true);
    });

    it("surfaces store-level rejection when period is no longer closed (race condition)", async () => {
      render(<PeriodCloseDashboard runs={[makeRun({ id: "tx_001" })]} />);

      const card = screen.getByTestId("period-close-card-tx_001");
      fireEvent.click(within(card).getByTestId("reopen-btn-tx_001"));

      fireEvent.change(screen.getByRole("textbox", { name: /reopen reason/i }), {
        target: { value: VALID_REOPEN_REASON },
      });
      fireEvent.click(screen.getByRole("checkbox", { name: /I understand that reopening/i }));

      usePeriodCloseStore.setState({ closedPayrollRunIds: [] });

      fireEvent.click(screen.getByRole("button", { name: /Confirm reopen/i }));

      await waitFor(() => {
        expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText(/not currently closed/i).length).toBeGreaterThan(0);
      expect(screen.getByTestId("period-reopen-dialog")).toBeInTheDocument();
    });
  });
});
