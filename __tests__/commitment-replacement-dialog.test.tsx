import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommitmentReplacementDialog } from "@/components/features/employees/CommitmentReplacementDialog";
import { useEmployeeStore } from "@/stores/employees";
import type { Employee } from "@/types/models";

const employee: Employee = {
  id: "emp_001",
  address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQR",
  name: "Jane Doe",
  salary: 125000,
  salaryCommitment: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  isActive: true,
  onboardingStatus: "complete",
  startDate: "2024-01-01T00:00:00Z",
};

describe("CommitmentReplacementDialog (#757)", () => {
  beforeEach(() => {
    useEmployeeStore.setState({
      employees: [employee],
      commitmentReplacementLog: [],
    });
  });

  it("shows the review summary and applies + logs the change on confirm (success path)", () => {
    const onConfirmed = () => {};
    render(
      <CommitmentReplacementDialog
        isOpen={true}
        employee={employee}
        nextCommitment="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        confirmedBy="operator_01"
        onCancel={() => {}}
        onConfirmed={onConfirmed}
      />,
    );

    expect(screen.getByTestId("commitment-replacement-summary")).toBeInTheDocument();
    expect(screen.getByText(/Salary commitment hash/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /confirm replacement/i }));

    const state = useEmployeeStore.getState();
    expect(state.employees.find((e) => e.id === employee.id)?.salaryCommitment).toBe(
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    expect(state.commitmentReplacementLog).toHaveLength(1);
    expect(state.commitmentReplacementLog[0].confirmedBy).toBe("operator_01");
  });

  it("blocks confirmation and shows an actionable error for a no-op replacement (failure/boundary path)", () => {
    render(
      <CommitmentReplacementDialog
        isOpen={true}
        employee={employee}
        nextCommitment={employee.salaryCommitment}
        onCancel={() => {}}
        onConfirmed={() => {}}
      />,
    );

    expect(screen.getByTestId("commitment-replacement-error")).toBeInTheDocument();
    expect(screen.getByText(/COMMITMENT_UNCHANGED/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm replacement/i })).toBeDisabled();

    // No employee record or log entry should change.
    expect(useEmployeeStore.getState().commitmentReplacementLog).toHaveLength(0);
  });

  it("never renders the raw salary amount anywhere in the dialog", () => {
    render(
      <CommitmentReplacementDialog
        isOpen={true}
        employee={employee}
        nextCommitment="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        onCancel={() => {}}
        onConfirmed={() => {}}
      />,
    );

    expect(screen.queryByText(/125000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/125,000/)).not.toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <CommitmentReplacementDialog
        isOpen={false}
        employee={employee}
        nextCommitment="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        onCancel={() => {}}
        onConfirmed={() => {}}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
