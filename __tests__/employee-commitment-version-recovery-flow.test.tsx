import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmployeeDetailPageContent from "@/components/features/employees/EmployeeDetailPageContent";
import { useEmployeeStore } from "@/stores/employees";
import type { Employee } from "@/types/models";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/employees/emp_flow_01",
}));

const employee: Employee = {
  id: "emp_flow_01",
  address: "GFLOWADDRESS11111111111111111111111111111111111111111111",
  name: "Bruce Wayne",
  email: "bruce@zkpayroll.io",
  salary: 175000,
  salaryCommitment: "0x1111111111111111111111111111",
  isActive: true,
  onboardingStatus: "completed",
  startDate: "2024-01-01T00:00:00Z",
};

describe("Employee Detail Page Commitment Version Recovery Flow (#900, #962)", () => {
  beforeEach(() => {
    useEmployeeStore.setState({
      employees: [employee],
      commitmentReplacementLog: [],
      isLoading: false,
    });
  });

  it("renders initial commitment version 1 as active with no recover action", () => {
    render(<EmployeeDetailPageContent employeeId={employee.id} />);

    expect(screen.getByText("Salary Commitment History")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recover commitment version 1/i })).not.toBeInTheDocument();
  });

  it("displays superseded versions with recovery action after replacement, and allows version recovery", () => {
    // 1. Perform a commitment replacement to create Version 2
    useEmployeeStore.setState({
      employees: [{ ...employee, salaryCommitment: "0x2222222222222222222222222222" }],
      commitmentReplacementLog: [
        {
          id: "log_rep_1",
          employeeId: employee.id,
          changeKind: "commitment_only",
          previousCommitmentPreview: "0x11111111…",
          nextCommitmentPreview: "0x22222222…",
          previousCommitment: "0x1111111111111111111111111111",
          nextCommitment: "0x2222222222222222222222222222",
          confirmedAt: "2024-02-01T00:00:00Z",
          confirmedBy: "operator_01",
          version: 2,
        },
      ],
      isLoading: false,
    });

    const { rerender } = render(<EmployeeDetailPageContent employeeId={employee.id} />);

    // Check version table
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("Superseded")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    // Version 1 should have a "Recover" button
    const recoverBtn = screen.getByTestId("recover-version-1");
    expect(recoverBtn).toBeInTheDocument();

    // 2. Click "Recover" on Version 1 to open the recovery dialog
    fireEvent.click(recoverBtn);

    expect(screen.getByTestId("commitment-version-recovery-dialog")).toBeInTheDocument();
    expect(screen.getByText(/Target Version to Restore/i)).toBeInTheDocument();
    expect(screen.getByText(/v1 \(Superseded\)/i)).toBeInTheDocument();

    // 3. Confirm the recovery
    const confirmRecoveryBtn = screen.getByTestId("confirm-recovery-btn");
    fireEvent.click(confirmRecoveryBtn);

    // Dialog should close
    expect(screen.queryByTestId("commitment-version-recovery-dialog")).not.toBeInTheDocument();

    // Store should now have 2 log entries and active commitment back to v1
    const state = useEmployeeStore.getState();
    const updatedEmployee = state.employees.find((e) => e.id === employee.id);
    expect(updatedEmployee?.salaryCommitment).toBe("0x1111111111111111111111111111");
    expect(state.commitmentReplacementLog).toHaveLength(2);

    // Rerender page content with updated store state
    rerender(<EmployeeDetailPageContent employeeId={employee.id} />);

    // Now v3 should be visible as active (Restored from v1)
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText(/Restored \(v1\)/i)).toBeInTheDocument();
  });

  it("never displays raw salary numbers in the commitment history card", () => {
    render(<EmployeeDetailPageContent employeeId={employee.id} />);
    const card = screen.getByText("Salary Commitment History").closest("div");
    expect(card?.textContent).not.toContain("175000");
    expect(card?.textContent).not.toContain("175,000");
  });
});
