import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import DelegatedApproverPanel from "@/components/features/approvals/DelegatedApproverPanel";
import { useDelegatedApproversStore } from "@/stores/delegatedApprovers";

const MOCK_EXISTING_APPROVER = {
  id: "del_test_001",
  address: "GAYN325M3W4R3J2J53X2Z3Q4W5E6R7T8Y9U0I1O2P3A4S5D6F7G8H9J0",
  label: "Primary Finance Delegate",
  addedAt: "2026-07-20T10:00:00Z",
  addedBy: "Executive Admin",
};

describe("DelegatedApproverPanel (Issue #536)", () => {
  beforeEach(() => {
    useDelegatedApproversStore.setState({
      approvers: [MOCK_EXISTING_APPROVER],
    });
  });

  it("Renders the panel with an existing list of delegated approvers", () => {
    render(<DelegatedApproverPanel />);

    expect(screen.getByText("Delegated Approver Management")).toBeInTheDocument();
    expect(screen.getByText("Primary Finance Delegate")).toBeInTheDocument();
    // Check that masked or full address exists
    expect(screen.getByText(/GAYN325M/i)).toBeInTheDocument();
  });

  it("Adding a valid approver updates the list", async () => {
    const user = userEvent.setup();
    render(<DelegatedApproverPanel />);

    const newAddress = "GB7N6543210987654321098765432109876543210987654321098765";
    const addressInput = screen.getByLabelText(/Stellar Address or Delegate Identifier/i);
    const labelInput = screen.getByLabelText(/Role \/ Description/i);
    const submitButton = screen.getByRole("button", { name: /Add Delegated Approver/i });

    await user.type(addressInput, newAddress);
    await user.type(labelInput, "Operations Delegate");
    await user.click(submitButton);

    expect(screen.getByText(/Operations Delegate/i)).toBeInTheDocument();
    expect(screen.getByText(/GB7N6543/i)).toBeInTheDocument();
    expect(useDelegatedApproversStore.getState().approvers).toHaveLength(2);
  });

  it("Adding a duplicate approver shows a validation error without updating the list", async () => {
    const user = userEvent.setup();
    render(<DelegatedApproverPanel />);

    const addressInput = screen.getByLabelText(/Stellar Address or Delegate Identifier/i);
    const submitButton = screen.getByRole("button", { name: /Add Delegated Approver/i });

    await user.type(addressInput, MOCK_EXISTING_APPROVER.address);
    await user.click(submitButton);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Duplicate approver address or identifier already exists/i);
    expect(useDelegatedApproversStore.getState().approvers).toHaveLength(1);
  });

  it("Adding an empty or invalid input shows a validation error", async () => {
    const user = userEvent.setup();
    render(<DelegatedApproverPanel />);

    const addressInput = screen.getByLabelText(/Stellar Address or Delegate Identifier/i);
    const submitButton = screen.getByRole("button", { name: /Add Delegated Approver/i });

    // Test empty input
    await user.click(submitButton);
    expect(screen.getByRole("alert")).toHaveTextContent(/Approver address or identifier is required/i);
    expect(useDelegatedApproversStore.getState().approvers).toHaveLength(1);

    // Test invalid format input (e.g., special characters like "@@@!!!")
    await user.type(addressInput, "@@@!!!");
    await user.click(submitButton);
    expect(screen.getByRole("alert")).toHaveTextContent(/Invalid address format/i);
    expect(useDelegatedApproversStore.getState().approvers).toHaveLength(1);
  });

  it("Removing an approver updates the list", async () => {
    const user = userEvent.setup();
    render(<DelegatedApproverPanel />);

    expect(screen.getByText("Primary Finance Delegate")).toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: /Remove approver/i });
    await user.click(removeButton);

    expect(screen.queryByText("Primary Finance Delegate")).not.toBeInTheDocument();
    expect(screen.getByText("No delegated approvers added yet")).toBeInTheDocument();
    expect(useDelegatedApproversStore.getState().approvers).toHaveLength(0);
  });

  it("No sensitive payroll data appears in any rendered error message", async () => {
    const user = userEvent.setup();
    render(<DelegatedApproverPanel />);

    const addressInput = screen.getByLabelText(/Stellar Address or Delegate Identifier/i);
    const submitButton = screen.getByRole("button", { name: /Add Delegated Approver/i });

    // Trigger duplicate error
    await user.type(addressInput, MOCK_EXISTING_APPROVER.address);
    await user.click(submitButton);

    const alertText = screen.getByRole("alert").textContent || "";

    // Verify privacy constraints
    const sensitivePatterns = [
      /\$\d+/i, // Dollar amounts e.g., $1000
      /salary/i,
      /wage/i,
      /payment amount/i,
      /disbursement/i,
      /employee name/i,
      /ssn/i,
    ];

    sensitivePatterns.forEach((pattern) => {
      expect(alertText).not.toMatch(pattern);
    });
  });
});
