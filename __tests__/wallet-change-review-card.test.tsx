import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import WalletChangeReviewCard from "@/components/review/WalletChangeReviewCard";
import { useWalletRotationStore } from "@/stores/walletRotation";
import type { WalletRotationRequest } from "@/types";

const request: WalletRotationRequest = {
  id: "rotation-1",
  employeeId: "employee-1",
  employeeName: "Jane Doe",
  previousWallet: "GOLDPREVIOUSWALLET1234567890",
  newWallet: "GOLDNEWDESTINATION1234567890",
  reasonCode: "scheduled_rotation",
  requestedBy: "manager-1",
  requestedAt: "2026-01-15T10:00:00Z",
  status: "pending",
  events: [],
};

describe("WalletChangeReviewCard", () => {
  beforeEach(() => useWalletRotationStore.getState().reset());

  it("renders a pending change with masked destinations and confirms it", () => {
    useWalletRotationStore.getState().addRequest(request);
    render(<WalletChangeReviewCard employeeId="employee-1" />);

    expect(screen.getByText("Wallet change requires review")).toBeInTheDocument();
    expect(screen.getByText("GOLDNE…7890")).toBeInTheDocument();
    expect(screen.queryByText(request.newWallet)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /confirm destination/i }));
    expect(useWalletRotationStore.getState().getRequestForEmployee("employee-1")?.status).toBe("cooldown");
  });

  it("renders loading and error states", () => {
    const { rerender } = render(<WalletChangeReviewCard employeeId="employee-1" isLoading />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading wallet change/i);

    rerender(<WalletChangeReviewCard employeeId="employee-1" error="Wallet service unavailable" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Wallet service unavailable");
  });

  it("requires a rejection reason and handles an empty review path", () => {
    render(<WalletChangeReviewCard employeeId="employee-1" request={request} />);
    const rejectButton = screen.getByRole("button", { name: /reject change/i });
    expect(rejectButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/rejection reason/i), { target: { value: "Destination was not authorized" } });
    expect(rejectButton).not.toBeDisabled();

    const { container } = render(<WalletChangeReviewCard employeeId="employee-2" request={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});