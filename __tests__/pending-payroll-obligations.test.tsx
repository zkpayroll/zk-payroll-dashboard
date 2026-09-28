import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PendingPayrollObligationsPanel } from "@/components/features/payroll/PendingPayrollObligationsPanel";
import type { PayrollRun } from "@/types/models";

const run = (overrides: Partial<PayrollRun> = {}): PayrollRun => ({
  id: "run-private-id",
  companyId: "company-1",
  timestamp: "2026-09-28T10:00:00Z",
  createdAt: "2026-09-28T10:00:00Z",
  totalAmount: 987654,
  employeeCount: 3,
  proof: "private-proof",
  status: "pending",
  employeeIds: ["private-employee"],
  ...overrides,
});

describe("PendingPayrollObligationsPanel", () => {
  it("shows pending run counts and period metadata without payroll amounts or employee details", () => {
    render(<PendingPayrollObligationsPanel runs={[run()]} />);

    expect(screen.getByText("Pending payroll obligations")).toBeInTheDocument();
    expect(screen.getByText(/1 payroll run needs review or execution/i)).toBeInTheDocument();
    expect(screen.getByText("3 recipients · Awaiting processing")).toBeInTheDocument();
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.queryByText(/987654|private-employee|private-proof/)).not.toBeInTheDocument();
  });

  it("excludes cancelled runs and provides a clear empty state", () => {
    render(<PendingPayrollObligationsPanel runs={[run({ status: "cancelled" })]} />);

    expect(screen.getByText("0 pending")).toBeInTheDocument();
    expect(screen.getByText("No pending payroll obligations.")).toBeInTheDocument();
  });
});
