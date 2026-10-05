import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EmployeeAuditSidebar from "@/components/features/employees/EmployeeAuditSidebar";
import type { Employee } from "@/types";

const baseEmployee: Employee = {
  id: "emp_001",
  address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
  name: "Alice Mensah",
  email: "alice@zkpayroll.io",
  department: "Engineering",
  salary: 5000,
  salaryCommitment: "0xabc123def456",
  isActive: true,
  status: "active",
  onboardingStatus: "completed",
  startDate: "2024-01-15T00:00:00Z",
  lastPayment: "2025-02-28T09:01:00Z",
};

describe("EmployeeAuditSidebar", () => {
  it("renders onboarding status, eligibility, and last update", () => {
    render(<EmployeeAuditSidebar employee={baseEmployee} />);

    expect(
      screen.getByRole("heading", { name: /audit summary/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText(/last update/i)).toBeInTheDocument();
  });

  it("never renders raw salary or commitment values", () => {
    render(<EmployeeAuditSidebar employee={baseEmployee} />);

    expect(screen.queryByText(/5,?000/)).not.toBeInTheDocument();
    expect(screen.queryByText(baseEmployee.salaryCommitment)).not.toBeInTheDocument();
    expect(
      screen.getByText(/salary amounts and commitment values are never shown/i),
    ).toBeInTheDocument();
  });

  it("shows an eligibility-revoked event for inactive employees", () => {
    const inactiveEmployee: Employee = {
      ...baseEmployee,
      isActive: false,
      status: "inactive",
    };

    render(<EmployeeAuditSidebar employee={inactiveEmployee} />);

    expect(screen.getByText("inactive")).toBeInTheDocument();
    expect(screen.getByText(/payroll eligibility revoked/i)).toBeInTheDocument();
  });

  it("surfaces onboarding retry failures with the error detail", () => {
    const retryingEmployee: Employee = {
      ...baseEmployee,
      status: "pending",
      onboardingStatus: "in_progress",
      onboardingRetryCount: 2,
      onboardingError: "Wallet connection timed out during submission",
      lastOnboardingAttemptAt: "2025-04-01T09:15:00Z",
    };

    render(<EmployeeAuditSidebar employee={retryingEmployee} />);

    expect(screen.getByText(/onboarding retry attempted/i)).toBeInTheDocument();
    expect(
      screen.getByText("Wallet connection timed out during submission"),
    ).toBeInTheDocument();
  });
});
