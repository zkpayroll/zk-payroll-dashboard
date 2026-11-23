import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";
import React from "react";
import {
  WalletChangeReviewCard,
  PayoutDestinationChangeReview,
} from "@/components/review";
import { useWalletRotationStore } from "@/stores/walletRotation";
import {
  validateDestinationAddress,
  validatePayoutDestinationChangeApproval,
  validatePayoutDestinationChangeRejection,
} from "@/lib/validation/payoutDestination";
import { evaluatePayoutDestinationChange } from "@/src/payroll/payoutDestinationReview";
import type { WalletRotationRequest } from "@/types";

const mockPendingRequest: WalletRotationRequest = {
  id: "rotation-101",
  employeeId: "emp-101",
  employeeName: "Alice Walker",
  previousWallet: "GBW6GJMW5SAQXQJT3XNCF6K7YJ5Y7Z2ZG6X4VJQ5XK5Z5X5X5X5X5X5",
  newWallet: "GCZJQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z",
  reasonCode: "scheduled_rotation",
  requestedBy: "lead-admin",
  requestedAt: "2026-09-20T10:00:00Z",
  status: "pending",
  events: [],
};

describe("Payout Destination Change Review — Validation Functions", () => {
  it("validateDestinationAddress validates Stellar public key formats", () => {
    expect(validateDestinationAddress("")).toBe("Destination address is required.");
    expect(validateDestinationAddress("   ")).toBe("Destination address is required.");
    expect(validateDestinationAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
      "Invalid destination address format. Stellar public addresses must start with G.",
    );
    expect(validateDestinationAddress("G123")).toContain("alphanumeric Stellar address");
    expect(
      validateDestinationAddress("GCZJQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z"),
    ).toBeNull();
    // 28-char mock addresses are also supported
    expect(validateDestinationAddress("GOLDNEWDESTINATION1234567890")).toBeNull();
  });

  it("validatePayoutDestinationChangeApproval blocks non-pending requests", () => {
    const res = validatePayoutDestinationChangeApproval({
      status: "cooldown",
      newWallet: "GCZJQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z",
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("cannot be approved");
  });

  it("validatePayoutDestinationChangeApproval blocks empty or invalid newWallet", () => {
    const resEmpty = validatePayoutDestinationChangeApproval({
      status: "pending",
      newWallet: "",
    });
    expect(resEmpty.isValid).toBe(false);
    expect(resEmpty.error).toBe("New destination address is required.");

    const resInvalid = validatePayoutDestinationChangeApproval({
      status: "pending",
      newWallet: "0xBadAddressFormat",
    });
    expect(resInvalid.isValid).toBe(false);
    expect(resInvalid.error).toContain("Stellar public addresses must start with G");
  });

  it("validatePayoutDestinationChangeApproval blocks identical previous and new destination", () => {
    const res = validatePayoutDestinationChangeApproval({
      status: "pending",
      previousWallet: "GCZJQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z",
      newWallet: "GCZJQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z",
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("matches the previous destination address");
  });

  it("validatePayoutDestinationChangeApproval blocks confirmation during active cooldown", () => {
    const res = validatePayoutDestinationChangeApproval({
      status: "pending",
      previousWallet: "GBW6GJMW5SAQXQJT3XNCF6K7YJ5Y7Z2ZG6X4VJQ5XK5Z5X5X5X5X5X5",
      newWallet: "GCZJQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z",
      isCooldownActive: true,
    });
    expect(res.isValid).toBe(false);
    expect(res.error?.toLowerCase()).toContain("payout destination is locked while an active wallet rotation cooldown is in progress");
  });

  it("validatePayoutDestinationChangeRejection validates length and reason presence", () => {
    expect(validatePayoutDestinationChangeRejection("").isValid).toBe(false);
    expect(validatePayoutDestinationChangeRejection("").error).toContain(
      "Rejection reason is required",
    );

    expect(validatePayoutDestinationChangeRejection("no").isValid).toBe(false);
    expect(validatePayoutDestinationChangeRejection("no").error).toContain(
      "at least 5 characters",
    );

    expect(validatePayoutDestinationChangeRejection("a".repeat(301)).isValid).toBe(false);
    expect(validatePayoutDestinationChangeRejection("a".repeat(301)).error).toContain(
      "cannot exceed 300 characters",
    );

    expect(
      validatePayoutDestinationChangeRejection("Contractor wallet change was not verified").isValid,
    ).toBe(true);
  });

  it("evaluatePayoutDestinationChange derives masked fields and human-readable reason labels", () => {
    const evaluation = evaluatePayoutDestinationChange(mockPendingRequest, false);
    expect(evaluation.canApprove).toBe(true);
    expect(evaluation.reasonLabel).toBe("Scheduled Rotation");
    expect(evaluation.maskedPrevious).toBe("GBW6GJ…X5X5");
    expect(evaluation.maskedNew).toBe("GCZJQ5…5Z5Z");
    expect(evaluation.isEmergency).toBe(false);
  });
});

describe("PayoutDestinationChangeReview Component", () => {
  beforeEach(() => {
    useWalletRotationStore.getState().reset();
  });

  it("renders pending destination change with reason and masks both wallets", () => {
    render(<PayoutDestinationChangeReview request={mockPendingRequest} />);

    expect(screen.getByText("Wallet change requires review")).toBeInTheDocument();
    expect(screen.getByText(/Alice Walker's destination changed/i)).toBeInTheDocument();
    expect(screen.getByText("Scheduled Rotation")).toBeInTheDocument();
    expect(screen.getByText("GBW6GJ…X5X5")).toBeInTheDocument();
    expect(screen.getByText("GCZJQ5…5Z5Z")).toBeInTheDocument();
    expect(screen.getByText(/Wallet addresses stay masked in this review surface/i)).toBeInTheDocument();
  });

  it("renders emergency badge for emergency requests", () => {
    const emergencyReq: WalletRotationRequest = {
      ...mockPendingRequest,
      id: "rot-emergency",
      isEmergency: true,
      reasonCode: "emergency",
    };

    render(<PayoutDestinationChangeReview request={emergencyReq} />);
    expect(screen.getAllByText("Emergency").length).toBeGreaterThanOrEqual(1);
  });

  it("successfully approves a valid destination change and triggers callbacks", () => {
    useWalletRotationStore.getState().addRequest(mockPendingRequest);
    const onApprove = vi.fn();

    render(
      <PayoutDestinationChangeReview
        employeeId="emp-101"
        onApprove={onApprove}
        reviewerName="Chief Financial Officer"
      />,
    );

    const confirmBtn = screen.getByRole("button", { name: /confirm destination/i });
    fireEvent.click(confirmBtn);

    const stored = useWalletRotationStore.getState().getRequestForEmployee("emp-101");
    expect(stored?.status).toBe("cooldown");
    expect(stored?.approvedBy).toBe("Chief Financial Officer");
    expect(onApprove).toHaveBeenCalledWith("rotation-101");
  });

  it("blocks confirmation when the new destination matches previous destination", () => {
    const identicalReq: WalletRotationRequest = {
      ...mockPendingRequest,
      newWallet: mockPendingRequest.previousWallet,
    };
    useWalletRotationStore.getState().addRequest(identicalReq);

    render(<PayoutDestinationChangeReview employeeId="emp-101" />);

    const confirmBtn = screen.getByRole("button", { name: /confirm destination/i });
    fireEvent.click(confirmBtn);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cannot confirm destination: New destination address matches the previous destination address.",
    );
    expect(useWalletRotationStore.getState().getRequestForEmployee("emp-101")?.status).toBe(
      "pending",
    );
  });

  it("blocks confirmation when an active cooldown exists on the employee", () => {
    useWalletRotationStore.getState().addRequest(mockPendingRequest);
    useWalletRotationStore
      .getState()
      .activateCooldown("prior-rot", "emp-101", 24 * 60 * 60 * 1000);

    render(<PayoutDestinationChangeReview employeeId="emp-101" />);

    const confirmBtn = screen.getByRole("button", { name: /confirm destination/i });
    fireEvent.click(confirmBtn);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cannot confirm destination: Payout destination is locked while an active wallet rotation cooldown is in progress.",
    );
    expect(useWalletRotationStore.getState().getRequestForEmployee("emp-101")?.status).toBe(
      "pending",
    );
  });

  it("allows dismissing the action error alert banner", () => {
    const identicalReq: WalletRotationRequest = {
      ...mockPendingRequest,
      newWallet: mockPendingRequest.previousWallet,
    };
    useWalletRotationStore.getState().addRequest(identicalReq);

    render(<PayoutDestinationChangeReview employeeId="emp-101" />);

    fireEvent.click(screen.getByRole("button", { name: /confirm destination/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss error/i }));
    expect(screen.queryByText(/Review action blocked/i)).not.toBeInTheDocument();
  });

  it("shows inline error when rejection reason is too short, and rejects when valid", async () => {
    const user = userEvent.setup();
    useWalletRotationStore.getState().addRequest(mockPendingRequest);
    const onReject = vi.fn();

    render(
      <PayoutDestinationChangeReview
        employeeId="emp-101"
        onReject={onReject}
        reviewerName="Security Officer"
      />,
    );

    const input = screen.getByLabelText(/rejection reason/i);
    const rejectBtn = screen.getByRole("button", { name: /reject change/i });

    // Type a 3-character reason (too short)
    await user.type(input, "bad");
    expect(rejectBtn).not.toBeDisabled();
    await user.click(rejectBtn);

    // Shows actionable inline error
    expect(
      screen.getByText("Rejection reason must be at least 5 characters explaining why the destination was rejected."),
    ).toBeInTheDocument();
    expect(useWalletRotationStore.getState().getRequestForEmployee("emp-101")?.status).toBe(
      "pending",
    );

    // Correct the reason to valid
    await user.clear(input);
    await user.type(input, "Recipient identity could not be verified by auditor");
    await user.click(rejectBtn);

    const stored = useWalletRotationStore.getState().getRequestForEmployee("emp-101");
    expect(stored?.status).toBe("rejected");
    expect(stored?.rejectionReason).toBe("Recipient identity could not be verified by auditor");
    expect(stored?.approvedBy).toBe("Security Officer");
    expect(onReject).toHaveBeenCalledWith(
      "rotation-101",
      "Recipient identity could not be verified by auditor",
    );
  });

  it("renders dashboard empty state when no pending reviews exist in store", () => {
    render(<PayoutDestinationChangeReview />);

    expect(screen.getByText("Payout Destination Changes")).toBeInTheDocument();
    expect(
      screen.getByText("No pending payout destination changes require review."),
    ).toBeInTheDocument();
    expect(screen.getByText("All clear")).toBeInTheDocument();
  });

  it("renders multiple pending destination reviews in dashboard mode", () => {
    const req1: WalletRotationRequest = {
      ...mockPendingRequest,
      id: "rot-1",
      employeeId: "emp-1",
      employeeName: "Bob Smith",
    };
    const req2: WalletRotationRequest = {
      ...mockPendingRequest,
      id: "rot-2",
      employeeId: "emp-2",
      employeeName: "Carol Danvers",
    };
    useWalletRotationStore.getState().addRequest(req1);
    useWalletRotationStore.getState().addRequest(req2);

    render(<PayoutDestinationChangeReview />);

    expect(screen.getByText("2 pending reviews")).toBeInTheDocument();
    expect(screen.getByText(/Bob Smith/i)).toBeInTheDocument();
    expect(screen.getByText(/Carol Danvers/i)).toBeInTheDocument();
  });
});
