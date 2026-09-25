import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import ApproverThresholdRotation from "@/components/features/settings/ApproverThresholdRotation";
import { useApproverThresholdStore } from "@/stores/approverThreshold";
import { MOCK_APPROVER_THRESHOLD_POLICY, MOCK_BATCHES_ON_CURRENT_POLICY } from "@/lib/api/mockData";

describe("ApproverThresholdRotation", () => {
  beforeEach(() => {
    useApproverThresholdStore.setState({
      currentPolicy: MOCK_APPROVER_THRESHOLD_POLICY,
      batchesOnCurrentPolicy: MOCK_BATCHES_ON_CURRENT_POLICY,
      pendingRequest: null,
    });
  });

  it("displays the current threshold and policy version", () => {
    render(<ApproverThresholdRotation />);

    const currentThresholdCard = screen.getByText("Current threshold").closest("div") as HTMLElement;
    expect(within(currentThresholdCard).getByText(String(MOCK_APPROVER_THRESHOLD_POLICY.requiredApprovals))).toBeInTheDocument();
    expect(within(currentThresholdCard).getByText(`Policy version ${MOCK_APPROVER_THRESHOLD_POLICY.version}`)).toBeInTheDocument();
  });

  it("shows a preview of the pending threshold after proposing a change", () => {
    render(<ApproverThresholdRotation />);

    fireEvent.change(screen.getByLabelText(/new required approvals/i), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /preview change/i }));

    expect(screen.getByText("Confirm threshold rotation")).toBeInTheDocument();
    expect(screen.getByText(/from/)).toBeInTheDocument();
  });

  it("warns that batches locked to the old policy keep their requirement", () => {
    render(<ApproverThresholdRotation />);

    fireEvent.change(screen.getByLabelText(/new required approvals/i), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /preview change/i }));

    expect(
      screen.getByText(new RegExp(`${MOCK_BATCHES_ON_CURRENT_POLICY.length} batch`, "i")),
    ).toBeInTheDocument();
  });

  it("rejects an invalid threshold and stays on the normal (non-locked) state", () => {
    render(<ApproverThresholdRotation />);

    fireEvent.change(screen.getByLabelText(/new required approvals/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /preview change/i }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Confirm threshold rotation")).not.toBeInTheDocument();
  });

  it("requires the confirmation checkbox before the confirm button is enabled", () => {
    render(<ApproverThresholdRotation />);

    fireEvent.change(screen.getByLabelText(/new required approvals/i), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /preview change/i }));

    const confirmButton = screen.getByRole("button", { name: /confirm change/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmButton).not.toBeDisabled();
  });

  it("confirms the rotation and shows a success state", () => {
    render(<ApproverThresholdRotation />);

    fireEvent.change(screen.getByLabelText(/new required approvals/i), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /preview change/i }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /confirm change/i }));

    expect(screen.getByTestId("threshold-success-state")).toBeInTheDocument();
    expect(useApproverThresholdStore.getState().currentPolicy.requiredApprovals).toBe(4);
    expect(useApproverThresholdStore.getState().currentPolicy.version).toBe(
      MOCK_APPROVER_THRESHOLD_POLICY.version + 1,
    );
  });

  it("cancels a pending rotation and returns to the propose form", () => {
    render(<ApproverThresholdRotation />);

    fireEvent.change(screen.getByLabelText(/new required approvals/i), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /preview change/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByText("Confirm threshold rotation")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/new required approvals/i)).toBeInTheDocument();
    expect(useApproverThresholdStore.getState().pendingRequest).toBeNull();
  });
});
