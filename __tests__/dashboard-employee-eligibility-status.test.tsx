import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardEmployeeEligibilityStatusCheck from "@/components/features/dashboard/DashboardEmployeeEligibilityStatusCheck";
import { evaluateEmployeeEligibilityStatus } from "@/lib/employees/employeeEligibilityStatus";
import type { Employee } from "@/types/models";

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

describe("DashboardEmployeeEligibilityStatusCheck", () => {
  it("reports ready when all employees are eligible", () => {
    render(<DashboardEmployeeEligibilityStatusCheck employees={[makeEmployee()]} />);

    const section = screen.getByTestId("dashboard-employee-eligibility");
    expect(section).toHaveAttribute("data-status", "valid");
    expect(screen.getByText(/All employees are eligible for payroll/i)).toBeInTheDocument();
  });

  it("reports notice when there are ineligible employees", () => {
    const inactiveEmployee = makeEmployee({
      id: "e-2",
      isActive: false,
      status: "inactive",
      lifecycleStatus: "offboarded",
    });
    
    const suspendedEmployee = makeEmployee({
      id: "e-3",
      isActive: true,
      status: "active",
      lifecycleStatus: "suspended",
    });

    render(<DashboardEmployeeEligibilityStatusCheck employees={[makeEmployee(), inactiveEmployee, suspendedEmployee]} />);

    const section = screen.getByTestId("dashboard-employee-eligibility");
    expect(section).toHaveAttribute("data-status", "warning");
    expect(screen.getByText(/2 of 3 employees are ineligible for payroll/i)).toBeInTheDocument();
    expect(screen.getByText(/1 employee is inactive/i)).toBeInTheDocument();
    expect(screen.getByText(/1 employee is suspended/i)).toBeInTheDocument();
  });

  it("handles empty employee list safely", () => {
    render(<DashboardEmployeeEligibilityStatusCheck employees={[]} />);

    const section = screen.getByTestId("dashboard-employee-eligibility");
    expect(section).toHaveAttribute("data-status", "valid");
    expect(screen.getByText(/No employees found in the roster/i)).toBeInTheDocument();
  });

  it("renders mock data correctly when undefined is passed", () => {
    render(<DashboardEmployeeEligibilityStatusCheck employees={undefined} />);
    const section = screen.getByTestId("dashboard-employee-eligibility");
    expect(section).toHaveAttribute("data-status", "warning");
    expect(screen.getByText(/1 of 2 employees are ineligible for payroll/i)).toBeInTheDocument();
  });
});

describe("evaluateEmployeeEligibilityStatus", () => {
  it("returns valid for eligible employees", () => {
    const result = evaluateEmployeeEligibilityStatus([makeEmployee()]);
    expect(result.status).toBe("valid");
    expect(result.eligibleCount).toBe(1);
    expect(result.ineligibleCount).toBe(0);
  });

  it("returns warning for ineligible employees", () => {
    const result = evaluateEmployeeEligibilityStatus([
      makeEmployee(),
      makeEmployee({ isActive: false, status: "inactive" })
    ]);
    expect(result.status).toBe("warning");
    expect(result.ineligibleCount).toBe(1);
    expect(result.inactiveCount).toBe(1);
  });
});
