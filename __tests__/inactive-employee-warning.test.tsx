import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Employee, PayrollRun } from "@/types/models";
import { InactiveEmployeeWarning } from "@/components/warnings/InactiveEmployeeWarning";
import PayrollReviewRiskScoring from "@/components/features/payroll/PayrollReviewRiskScoring";

function makeEmployee(overrides: Partial<Employee> & { id: string }): Employee {
  return {
    address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    name: `Employee ${overrides.id}`,
    email: `${overrides.id}@zkpayroll.io`,
    department: "Engineering",
    salary: 5250,
    salaryCommitment: "0xsecretcommitment456",
    isActive: true,
    status: "active",
    onboardingStatus: "completed",
    startDate: "2024-01-15T00:00:00Z",
    lastPayment: "2026-09-20T09:00:00Z",
    ...overrides,
  };
}

const activeEmployee = makeEmployee({ id: "emp_001", name: "Alice Mensah" });
const inactiveEmployee = makeEmployee({
  id: "emp_003",
  name: "Amara Diallo",
  isActive: false,
  status: "inactive",
});
const suspendedEmployee = makeEmployee({
  id: "emp_004",
  name: "Kofi Boateng",
  lifecycleStatus: "suspended",
});

const roster = [activeEmployee, inactiveEmployee, suspendedEmployee];

describe("InactiveEmployeeWarning", () => {
  it("renders nothing when every employee in the draft is eligible", () => {
    const { container } = render(
      <InactiveEmployeeWarning employees={roster} employeeIds={["emp_001"]} />,
    );

    expect(screen.queryByTestId("inactive-employee-warning")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("warns the reviewer about inactive and suspended employees in the draft", () => {
    render(
      <InactiveEmployeeWarning
        employees={roster}
        employeeIds={["emp_001", "emp_003", "emp_004"]}
      />,
    );

    const alert = screen.getByTestId("inactive-employee-warning");
    expect(alert).toHaveAttribute("role", "alert");
    expect(screen.getByText("Inactive or suspended employees in this payroll")).toBeInTheDocument();
    expect(screen.getByTestId("inactive-employee-count")).toHaveTextContent(
      "2 affected",
    );
    expect(screen.getByTestId("ineligible-employee-emp_003")).toHaveTextContent(
      "Amara Diallo",
    );
    expect(screen.getByTestId("ineligible-employee-emp_004")).toHaveTextContent(
      "Kofi Boateng",
    );
    expect(screen.getByText("Suspended")).toBeInTheDocument();
    expect(
      screen.getByTestId("inactive-employee-next-steps"),
    ).toHaveTextContent("Remove these employees from the payroll draft");
  });

  it("does not render the eligible employee in the affected list", () => {
    render(
      <InactiveEmployeeWarning
        employees={roster}
        employeeIds={["emp_001", "emp_003"]}
      />,
    );

    expect(
      screen.queryByTestId("ineligible-employee-emp_001"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Alice Mensah")).not.toBeInTheDocument();
  });

  it("escalates to a critical alert for stale draft ids", () => {
    render(
      <InactiveEmployeeWarning employees={roster} employeeIds={["emp_gone"]} />,
    );

    expect(
      screen.getByTestId("inactive-employee-warning"),
    ).toHaveAttribute("data-severity", "critical");
    expect(
      screen.getByText("Payroll draft references unavailable employee records"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ineligible-employee-emp_gone")).toHaveTextContent(
      "No longer in the employee roster",
    );
  });

  it("keeps compensation and wallet values out of the warning", () => {
    render(
      <InactiveEmployeeWarning
        employees={roster}
        employeeIds={["emp_003", "emp_004"]}
      />,
    );

    const text = screen.getByTestId("inactive-employee-warning")
      .textContent as string;

    expect(text).not.toContain("5250");
    expect(text).not.toContain("$");
    expect(text).not.toContain("0xsecretcommitment456");
    expect(text).not.toContain(activeEmployee.address);
  });
});

describe("PayrollReviewRiskScoring inactive-employee factor", () => {
  const runWith = (employeeIds: string[]): PayrollRun =>
    ({
      id: "tx_review",
      companyId: "company_001",
      timestamp: "2026-09-25T09:00:00Z",
      createdAt: "2026-09-25T09:00:00Z",
      totalAmount: 9500,
      employeeCount: employeeIds.length,
      proof: "",
      status: "pending",
      employeeIds,
      executedAt: null,
      transactionHash: null,
    }) as PayrollRun;

  it("scores a suspended employee as an inactive-employee risk", () => {
    render(
      <PayrollReviewRiskScoring
        payrollRun={runWith(["emp_001", "emp_004"])}
        employees={roster}
      />,
    );

    expect(
      screen.getByText("Inactive or Suspended Employees in Run"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Kofi Boateng/)).toBeInTheDocument();
  });

  it("stays clean when all selected employees are active", () => {
    render(
      <PayrollReviewRiskScoring
        payrollRun={runWith(["emp_001"])}
        employees={roster}
      />,
    );

    expect(
      screen.queryByText("Inactive or Suspended Employees in Run"),
    ).not.toBeInTheDocument();
  });
});
