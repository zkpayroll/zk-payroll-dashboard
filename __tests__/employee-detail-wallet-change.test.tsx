import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import EmployeeDetailPageContent from "@/components/features/employees/EmployeeDetailPageContent";
import { useWalletRotationStore } from "@/stores/walletRotation";
import { useEmployeeStore } from "@/stores/employees";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { WalletRotationRequest } from "@/types";

const employee = MOCK_EMPLOYEES[0];

const pendingChange: WalletRotationRequest = {
  id: "rotation-emp-001",
  employeeId: employee.id,
  employeeName: employee.name,
  previousWallet: employee.address,
  newWallet: "GNEWDESTINATION123456789012345678",
  reasonCode: "device_loss",
  requestedBy: "Ops Manager",
  requestedAt: "2026-02-01T09:00:00Z",
  status: "pending",
  events: [],
};

describe("Employee detail wallet change review integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useEmployeeStore.getState().setEmployees([]);
    useEmployeeStore.getState().setLoading(false);
    useWalletRotationStore.getState().reset();
  });

  it("surfaces the review card on the employee detail page when the wallet changed", () => {
    useWalletRotationStore.getState().addRequest(pendingChange);

    render(<EmployeeDetailPageContent employeeId={employee.id} />);

    expect(screen.getByTestId("wallet-change-review-card")).toBeInTheDocument();
    expect(screen.getByText("Wallet change requires review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm destination/i })).toBeInTheDocument();
    expect(screen.queryByText(pendingChange.newWallet)).not.toBeInTheDocument();
  });

  it("stays hidden when the employee has no pending wallet change", () => {
    render(<EmployeeDetailPageContent employeeId={employee.id} />);

    expect(screen.queryByTestId("wallet-change-review-card")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: employee.name })).toBeInTheDocument();
  });

  it("keeps the card out of the empty path for an unknown employee", () => {
    render(<EmployeeDetailPageContent employeeId="emp_does_not_exist" />);

    expect(screen.queryByTestId("wallet-change-review-card")).not.toBeInTheDocument();
    expect(screen.getByText(/employee not found/i)).toBeInTheDocument();
  });
});
