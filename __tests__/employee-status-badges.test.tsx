import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import EmployeeDirectory from "@/components/features/employees/EmployeeDirectory";
import { useEmployeeStore } from "@/stores/employees";
import type { Employee } from "@/types";

const employee = (overrides: Partial<Employee>): Employee => ({
  id: "employee-1",
  name: "Employee One",
  address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  salary: 1000,
  salaryCommitment: "commitment",
  isActive: true,
  onboardingStatus: "completed",
  startDate: "2025-01-01T00:00:00Z",
  lastPayment: "2025-01-31T00:00:00Z",
  ...overrides,
});

describe("EmployeeDirectory status badges", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useEmployeeStore.getState().setEmployees([]);
  });

  it("shows active and inactive eligibility badges in employee rows", () => {
    useEmployeeStore.getState().setEmployees([
      employee({ id: "active", name: "Active employee", status: "active" }),
      employee({ id: "inactive", name: "Inactive employee", status: "inactive", isActive: false }),
    ]);

    render(<EmployeeDirectory />);

    expect(screen.getAllByRole("status", { name: "Status: Active" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("status", { name: "Status: Inactive" }).length).toBeGreaterThan(0);
  });

  it("shows an inactive badge when eligibility conflicts with a stale active status", () => {
    useEmployeeStore.getState().setEmployees([
      employee({ name: "Ineligible employee", status: "active", isActive: false }),
    ]);

    render(<EmployeeDirectory />);

    expect(screen.getAllByRole("status", { name: "Status: Inactive" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("status", { name: "Status: Active" })).not.toBeInTheDocument();
  });
});
