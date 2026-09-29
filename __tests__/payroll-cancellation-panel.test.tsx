import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PayrollCancellationPanel } from "@/components/features/payroll/PayrollCancellationPanel";
import type { PayrollRun } from "@/types/models";

const baseRun: PayrollRun = {
  id: "run_001",
  companyId: "company_001",
  timestamp: "2025-02-28T10:00:00Z",
  createdAt: "2025-02-28T10:00:00Z",
  totalAmount: 10000,
  employeeCount: 5,
  proof: "0xabc",
  status: "cancelled",
  employeeIds: ["emp_001"],
  cancellationReason: "treasury_insufficient",
  cancellationDetail: "Treasury had insufficient funds for batch",
  cancelledAt: "2025-02-28T11:00:00Z",
  cancelledBy: "operator_001",
};

describe("PayrollCancellationPanel", () => {
  it("explains why a batch was cancelled and shows actions (success path)", () => {
    render(<PayrollCancellationPanel run={baseRun} />);
    expect(screen.getByTestId("payroll-cancellation-panel")).toBeInTheDocument();
    expect(screen.getByText(/Batch Cancelled/)).toBeInTheDocument();
    expect(screen.getByText(/Insufficient treasury funds/)).toBeInTheDocument();
    expect(screen.getAllByText(/Treasury had insufficient funds/).length).toBeGreaterThan(0);
    expect(screen.getByText(/What you can do next/)).toBeInTheDocument();
    expect(screen.getByText(/Top up treasury/)).toBeInTheDocument();
    expect(screen.getByText(/Cancelled at/)).toBeInTheDocument();
    expect(screen.getByText(/operator_001/)).toBeInTheDocument();
  });

  it("does not render for non-cancelled runs (failure path / edge)", () => {
    const { container } = render(<PayrollCancellationPanel run={{ ...baseRun, status: "pending" as const }} />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("payroll-cancellation-panel")).not.toBeInTheDocument();
  });

  it("handles unknown reason gracefully (edge case)", () => {
    const unknownRun: PayrollRun = { ...baseRun, cancellationReason: undefined, cancellationDetail: undefined };
    render(<PayrollCancellationPanel run={unknownRun} />);
    expect(screen.getByText(/Unknown reason/)).toBeInTheDocument();
    expect(screen.getByText(/No specific cancellation reason/)).toBeInTheDocument();
  });

  it("sanitizes private values in cancellation detail", () => {
    const leaked: PayrollRun = {
      ...baseRun,
      cancellationDetail: "Failed for emp@example.com with $5000",
    };
    render(<PayrollCancellationPanel run={leaked} />);
    expect(screen.queryByText(/emp@example\.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$5000/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/REDACTED/).length).toBeGreaterThan(0);
  });

  it("shows private payroll values remain redacted notice", () => {
    render(<PayrollCancellationPanel run={baseRun} />);
    expect(screen.getByText(/never shows individual salary amounts/)).toBeInTheDocument();
  });
});
