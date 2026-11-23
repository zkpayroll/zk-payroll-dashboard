import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Employee } from "@/types/models";
import {
  buildEmployeeEligibilityReport,
  classifyEmployeeEligibility,
} from "@/src/reports/employeeEligibilityReport";
import { EmployeeEligibilityReport } from "@/components/reports/EmployeeEligibilityReport";

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "e-1",
    address: "G...",
    name: "Test Employee",
    salary: 1000,
    salaryCommitment: "commit-1",
    isActive: true,
    status: "active",
    onboardingStatus: "completed",
    startDate: new Date().toISOString(),
    lifecycleStatus: "active",
    ...overrides,
  } as Employee;
}

describe("Employee payroll eligibility report (Issue #267)", () => {
  it("classifies eligible, ineligible, pending, and blocked employees (main path)", () => {
    const employees = [
      makeEmployee({ id: "e-ok", name: "Ready Employee" }),
      makeEmployee({
        id: "e-suspended",
        name: "Suspended Employee",
        lifecycleStatus: "suspended",
      }),
      makeEmployee({
        id: "e-pending",
        name: "Pending Employee",
        onboardingStatus: "in_progress",
      }),
      makeEmployee({
        id: "e-archived",
        name: "Archived Employee",
        lifecycleStatus: "archived",
      }),
    ];

    const report = buildEmployeeEligibilityReport(employees);

    expect(report.counts.eligible).toBe(1);
    expect(report.counts.ineligible).toBe(1);
    expect(report.counts.pending).toBe(1);
    expect(report.counts.blocked).toBe(1);
    expect(report.totalEmployees).toBe(4);
    expect(report.isEmptyRoster).toBe(false);

    const byId = Object.fromEntries(report.rows.map((r) => [r.employeeId, r]));
    expect(byId["e-ok"].state).toBe("eligible");
    expect(byId["e-suspended"].state).toBe("ineligible");
    expect(byId["e-suspended"].blockerType).toBe("suspended");
    expect(byId["e-pending"].state).toBe("pending");
    expect(byId["e-archived"].state).toBe("blocked");

    // Privacy rule: no salary values anywhere in the report.
    expect(JSON.stringify(report)).not.toContain("1000");
  });

  it("filters by department, state, and blocker type", () => {
    const employees = [
      makeEmployee({ id: "e-eng", department: "Engineering" }),
      makeEmployee({
        id: "e-eng-pending",
        department: "Engineering",
        onboardingStatus: "not_started",
      }),
      makeEmployee({ id: "e-hr", department: "HR" }),
    ];

    const byDepartment = buildEmployeeEligibilityReport(employees, {
      department: "Engineering",
    });
    expect(byDepartment.filteredCount).toBe(2);
    expect(byDepartment.rows.every((r) => r.department === "Engineering")).toBe(true);

    const byState = buildEmployeeEligibilityReport(employees, { state: "pending" });
    expect(byState.filteredCount).toBe(1);
    expect(byState.rows[0].employeeId).toBe("e-eng-pending");

    const byBlocker = buildEmployeeEligibilityReport(employees, {
      blockerType: "onboarding",
    });
    expect(byBlocker.filteredCount).toBe(1);
  });

  it("handles an empty roster and filters that remove every row (edge cases)", () => {
    const empty = buildEmployeeEligibilityReport([]);
    expect(empty.isEmptyRoster).toBe(true);
    expect(empty.rows).toHaveLength(0);
    expect(empty.summaryMessage).toMatch(/No employees found/i);

    const employees = [makeEmployee({ id: "e-1" })];
    const noMatch = buildEmployeeEligibilityReport(employees, {
      state: "blocked",
    });
    expect(noMatch.isEmptyRoster).toBe(false);
    expect(noMatch.filteredCount).toBe(0);
    expect(noMatch.summaryMessage).toMatch(/No employees match the current filters/i);
  });

  it("renders the report with filters and empty state in the component", () => {
    const employees = [
      makeEmployee({ id: "e-ok", name: "Ready Employee" }),
      makeEmployee({
        id: "e-pending",
        name: "Pending Employee",
        onboardingStatus: "in_progress",
      }),
    ];
    render(<EmployeeEligibilityReport employees={employees} />);

    expect(screen.getByTestId("employee-eligibility-report")).toBeInTheDocument();
    expect(screen.getByText("Ready Employee")).toBeInTheDocument();
    expect(screen.getByText("Pending Employee")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "pending" },
    });
    expect(screen.queryByText("Ready Employee")).toBeNull();
    expect(screen.getByText("Pending Employee")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "blocked" },
    });
    expect(screen.getByTestId("eligibility-report-empty")).toBeInTheDocument();
  });

  it("renders the empty-roster message when there are no employees", () => {
    render(<EmployeeEligibilityReport employees={[]} />);
    const empty = screen.getByTestId("eligibility-report-empty");
    expect(empty).toHaveTextContent(/No employees found in the roster/i);
  });

  it("classifyEmployeeEligibility never surfaces salary values", () => {
    const employee = makeEmployee({ salary: 987654 });
    const result = classifyEmployeeEligibility(employee);
    expect(JSON.stringify(result)).not.toContain("987654");
  });
});
