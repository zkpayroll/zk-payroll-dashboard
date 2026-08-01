import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollRunDetail from "@/components/features/payroll/PayrollRunDetail";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

describe("Payroll Run Detail", () => {
  it("renders scheduled submission-locked run without process action", () => {
    const run = MOCK_PAYROLL_RUNS.find((r) => r.id === "tx_003")!;
    render(<PayrollRunDetail run={run} />);

    expect(screen.getByRole("heading", { level: 1, name: /payroll run/i })).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByRole("alert", { name: /payroll run locked: submission/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /process payroll/i })).not.toBeInTheDocument();
  });

  it("renders completed run without process action", () => {
    const run = MOCK_PAYROLL_RUNS.find((r) => r.id === "tx_001")!;
    render(<PayrollRunDetail run={run} />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /process payroll/i })).not.toBeInTheDocument();
    expect(screen.getByText("abc123def456")).toBeInTheDocument();
  });

  it("provides back navigation button", () => {
    render(<PayrollRunDetail run={MOCK_PAYROLL_RUNS[0]} />);

    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("renders lock state banner for submission lock", () => {
    const run = {
      id: "lock_sub",
      companyId: "company_001",
      timestamp: "2026-07-28T20:00:00Z",
      createdAt: "2026-07-28T20:00:00Z",
      totalAmount: 1000,
      employeeCount: 1,
      proof: "",
      status: "pending" as const,
      employeeIds: ["emp_001"],
      executedAt: null,
      transactionHash: null,
    };
    render(<PayrollRunDetail run={run} />);
    expect(screen.getByRole("alert", { name: /payroll run locked: submission/i })).toBeInTheDocument();
    expect(screen.getByText(/locked for submission/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /process payroll/i })).not.toBeInTheDocument();
  });

  it("renders lock state banner for confirmation lock", () => {
    const run = {
      id: "lock_conf",
      companyId: "company_001",
      timestamp: "2026-07-28T20:00:00Z",
      createdAt: "2026-07-28T20:00:00Z",
      totalAmount: 1000,
      employeeCount: 1,
      proof: "proof-data",
      status: "pending" as const,
      employeeIds: ["emp_001"],
      executedAt: null,
      transactionHash: "0xhash",
    };
    render(<PayrollRunDetail run={run} />);
    expect(screen.getByRole("alert", { name: /payroll run locked: confirmation/i })).toBeInTheDocument();
    expect(screen.getByText(/locked for confirmation/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /process payroll/i })).not.toBeInTheDocument();
  });

  it("renders lock state banner for reconciliation lock", () => {
    const run = {
      id: "lock_recon",
      companyId: "company_001",
      timestamp: "2026-07-28T20:00:00Z",
      createdAt: "2026-07-28T20:00:00Z",
      totalAmount: 1000,
      employeeCount: 1,
      proof: "proof-data",
      status: "verified" as const,
      employeeIds: ["emp_001"],
      executedAt: "2026-07-28T20:05:00Z",
      transactionHash: "0xhash",
    };
    render(<PayrollRunDetail run={run} />);
    expect(screen.getByRole("alert", { name: /payroll run locked: reconciliation/i })).toBeInTheDocument();
    expect(screen.getByText(/locked for reconciliation/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /process payroll/i })).not.toBeInTheDocument();
  });

  it("renders lock state banner for cancellation lock", () => {
    const run = {
      id: "lock_cancel",
      companyId: "company_001",
      timestamp: "2026-07-28T20:00:00Z",
      createdAt: "2026-07-28T20:00:00Z",
      totalAmount: 1000,
      employeeCount: 1,
      proof: "",
      status: "cancelled" as const,
      employeeIds: ["emp_001"],
      executedAt: null,
      transactionHash: null,
    };
    render(<PayrollRunDetail run={run} />);
    expect(screen.getByRole("alert", { name: /payroll run locked: cancellation/i })).toBeInTheDocument();
    expect(screen.getByText(/cancelled and is locked/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /process payroll/i })).not.toBeInTheDocument();
  });
});
