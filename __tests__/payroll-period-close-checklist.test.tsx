import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PayrollPeriodCloseChecklist from "@/components/checklists/PayrollPeriodCloseChecklist";
import { buildPeriodCloseChecklist } from "@/lib/reconciliation/periodClose";

describe("PayrollPeriodCloseChecklist", () => {
  it("enables close button when all requirements (settlement, reconciliation, receipt review, audit handoff) are satisfied", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_period_001",
      locks: [],
      disputes: [],
      reservations: [],
      exportedAuditTimelineRunIds: ["tx_period_001"],
      settlementComplete: true,
      reconciliationComplete: true,
      receiptReviewComplete: true,
      auditHandoffComplete: true,
    });

    const onCloseSpy = vi.fn();
    render(<PayrollPeriodCloseChecklist checklist={checklist} onClosePeriod={onCloseSpy} />);

    expect(screen.getByText("Ready to Close")).toBeInTheDocument();
    const actionBtn = screen.getByRole("button", { name: /Close Payroll Period/i });
    expect(actionBtn).not.toBeDisabled();

    // Click trigger confirmation dialog
    fireEvent.click(actionBtn);
    expect(screen.getByTestId("period-close-confirmation-dialog")).toBeInTheDocument();

    // Confirm close
    fireEvent.click(screen.getByText("Confirm & Close Period"));
    expect(onCloseSpy).toHaveBeenCalledWith("tx_period_001");
  });

  it("blocks closing and disables close button when reconciliation or settlement is incomplete", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_period_002",
      locks: [],
      disputes: [],
      reservations: [],
      exportedAuditTimelineRunIds: ["tx_period_002"],
      settlementComplete: false,
      reconciliationComplete: false,
    });

    render(<PayrollPeriodCloseChecklist checklist={checklist} />);

    expect(screen.getByText(/Blocked/i)).toBeInTheDocument();
    const actionBtn = screen.getByRole("button", { name: /Resolve Blockers to Close/i });
    expect(actionBtn).toBeDisabled();

    expect(
      screen.getByText(/On-chain disbursement settlement is not complete/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Period reconciliation has unresolved variances/i),
    ).toBeInTheDocument();
  });

  it("confirms privacy guarantee: no sensitive salary values in checklist output", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_period_003",
      locks: [],
      disputes: [],
      reservations: [],
      exportedAuditTimelineRunIds: ["tx_period_003"],
    });

    render(<PayrollPeriodCloseChecklist checklist={checklist} />);

    const html = screen.getByTestId("payroll-period-close-checklist").innerHTML;
    expect(html).not.toContain("salary");
    expect(html).not.toContain("salaryCommitment");
  });
});
