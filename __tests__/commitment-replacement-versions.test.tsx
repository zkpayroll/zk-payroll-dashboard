import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommitmentReplacementDialog } from "@/components/features/employees/CommitmentReplacementDialog";
import { useEmployeeStore } from "@/stores/employees";
import type { Employee } from "@/types/models";

const employee: Employee = {
  id: "emp_002",
  address: "GOLDADDRESSABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGH",
  name: "John Roe",
  salary: 98000,
  salaryCommitment: "0xcccccccccccccccccccccccccccc",
  isActive: true,
  onboardingStatus: "complete",
  startDate: "2024-02-01T00:00:00Z",
};

const NEW_ADDRESS = "GNEWADDRESSABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI";

describe("CommitmentReplacementDialog versions (#900)", () => {
  beforeEach(() => {
    useEmployeeStore.setState({
      employees: [employee],
      commitmentReplacementLog: [],
    });
  });

  it("wallet-only change: summary names the wallet, and confirm updates only the address (success path)", () => {
    render(
      <CommitmentReplacementDialog
        isOpen={true}
        employee={employee}
        nextCommitment={employee.salaryCommitment}
        nextAddress={NEW_ADDRESS}
        confirmedBy="operator_02"
        onCancel={() => {}}
        onConfirmed={() => {}}
      />,
    );

    expect(screen.getByTestId("commitment-replacement-summary")).toHaveTextContent("Wallet address");
    fireEvent.click(screen.getByRole("button", { name: /confirm replacement/i }));

    const state = useEmployeeStore.getState();
    const updated = state.employees.find((e) => e.id === employee.id);
    expect(updated?.address).toBe(NEW_ADDRESS);
    expect(updated?.salaryCommitment).toBe(employee.salaryCommitment);
    expect(state.commitmentReplacementLog).toHaveLength(1);
    expect(state.commitmentReplacementLog[0]).toMatchObject({ changeKind: "wallet_only" });
  });

  it("commitment and wallet change together: both are applied and labelled as one change (success path)", () => {
    render(
      <CommitmentReplacementDialog
        isOpen={true}
        employee={employee}
        nextCommitment="0xdddddddddddddddddddddddddddd"
        nextAddress={NEW_ADDRESS}
        confirmedBy="operator_02"
        onCancel={() => {}}
        onConfirmed={() => {}}
      />,
    );

    expect(screen.getByTestId("commitment-replacement-summary")).toHaveTextContent(
      "Salary commitment hash and wallet address",
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm replacement/i }));

    const updated = useEmployeeStore.getState().employees.find((e) => e.id === employee.id);
    expect(updated?.salaryCommitment).toBe("0xdddddddddddddddddddddddddddd");
    expect(updated?.address).toBe(NEW_ADDRESS);
  });

  it("supplying the current address and commitment is rejected and cannot be confirmed (failure path)", () => {
    render(
      <CommitmentReplacementDialog
        isOpen={true}
        employee={employee}
        nextCommitment={employee.salaryCommitment}
        nextAddress={employee.address}
        confirmedBy="operator_02"
        onCancel={() => {}}
        onConfirmed={() => {}}
      />,
    );

    expect(screen.getByTestId("commitment-replacement-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm replacement/i })).toBeDisabled();
    expect(useEmployeeStore.getState().commitmentReplacementLog).toHaveLength(0);
  });
});
