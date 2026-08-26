import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ReconciliationDiscrepancyInspector from "@/components/features/payroll/ReconciliationDiscrepancyInspector";
import type { Employee, PayrollRun } from "@/types/models";

const NOW = 1_700_000_000_000;

const employees: Employee[] = [
  {
    id: "emp_a",
    address: "GADDRESSA",
    name: "Employee A",
    salary: 100,
    salaryCommitment: "0x1",
    isActive: true,
    onboardingStatus: "completed",
    startDate: "2024-01-01T00:00:00Z",
  },
  {
    id: "emp_b",
    address: "GADDRESSB",
    name: "Employee B",
    salary: 200,
    salaryCommitment: "0x2",
    isActive: true,
    onboardingStatus: "completed",
    startDate: "2024-01-01T00:00:00Z",
  },
];

const runs: PayrollRun[] = [
  {
    id: "run_ok",
    companyId: "company_001",
    timestamp: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    totalAmount: 300,
    employeeCount: 2,
    proof: "proof",
    status: "verified",
    employeeIds: ["emp_a", "emp_b"],
  },
  {
    id: "run_failed",
    companyId: "company_001",
    timestamp: "2025-01-02T00:00:00Z",
    createdAt: "2025-01-02T00:00:00Z",
    totalAmount: 300,
    employeeCount: 2,
    proof: "proof",
    status: "failed",
    employeeIds: ["emp_a", "emp_b"],
  },
];

describe("ReconciliationDiscrepancyInspector", () => {
  it("renders only runs that have discrepancies", () => {
    render(<ReconciliationDiscrepancyInspector runs={runs} employees={employees} now={NOW} />);
    expect(screen.getByText("Run run_failed")).toBeInTheDocument();
    expect(screen.queryByText("Run run_ok")).not.toBeInTheDocument();
  });

  it("shows the total discrepancy count", () => {
    render(<ReconciliationDiscrepancyInspector runs={runs} employees={employees} now={NOW} />);
    expect(screen.getByTestId("discrepancy-total-count")).not.toHaveTextContent("0 discrepancies");
  });

  it("shows the good-state message when there are no discrepancies", () => {
    render(
      <ReconciliationDiscrepancyInspector runs={[runs[0]]} employees={employees} now={NOW} />,
    );
    expect(screen.getByText("No discrepancies found — every run reconciles cleanly.")).toBeInTheDocument();
  });

  it("filters out all results when a non-matching category is selected", () => {
    render(<ReconciliationDiscrepancyInspector runs={runs} employees={employees} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Amount mismatch" }));
    expect(screen.getByText("No discrepancies match the current filters.")).toBeInTheDocument();
  });

  it("filters by search term", () => {
    render(<ReconciliationDiscrepancyInspector runs={runs} employees={employees} now={NOW} />);
    fireEvent.change(screen.getByPlaceholderText("Search run ID or recipient…"), {
      target: { value: "no-such-run" },
    });
    expect(screen.getByText("No discrepancies match the current filters.")).toBeInTheDocument();
  });
});
