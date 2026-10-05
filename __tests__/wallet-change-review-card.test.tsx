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
    expect(screen.getByText(/destination changed/i)).toBeInTheDocument();

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

  it("propagates the empty path for a rejected change and records the reason", () => {
    useWalletRotationStore.getState().addRequest(request);
    const { container } = render(<WalletChangeReviewCard employeeId="employee-1" />);

    fireEvent.change(screen.getByLabelText(/rejection reason/i), { target: { value: "Destination was not authorized" } });
    fireEvent.click(screen.getByRole("button", { name: /reject change/i }));

    const stored = useWalletRotationStore.getState().getRequestForEmployee("employee-1");
    expect(stored?.status).toBe("rejected");
    expect(stored?.rejectionReason).toBe("Destination was not authorized");
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes request provenance without leaking the full destination", () => {
    render(<WalletChangeReviewCard employeeId="employee-1" request={request} />);

    expect(screen.getByText("Scheduled rotation")).toBeInTheDocument();
    expect(screen.getByText("manager-1")).toBeInTheDocument();
    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.queryByText(request.newWallet)).not.toBeInTheDocument();
    expect(screen.queryByText(request.previousWallet)).not.toBeInTheDocument();
  });

  it("flags an emergency change before the next payroll run", () => {
    render(
      <WalletChangeReviewCard
        employeeId="employee-1"
        employeeName="Jane Doe"
        request={{ ...request, isEmergency: true, reasonCode: "emergency" }}
      />,
    );

    expect(screen.getByTestId("wallet-change-emergency-flag")).toHaveTextContent(/emergency wallet change/i);
    expect(screen.getByText("Emergency")).toBeInTheDocument();
    expect(screen.getByText(/stays paused until/i)).toBeInTheDocument();
  });

  it("hides review controls once the cooldown has started", () => {
    render(<WalletChangeReviewCard employeeId="employee-1" request={{ ...request, status: "cooldown" }} />);

    expect(screen.queryByRole("button", { name: /confirm destination/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/rejection reason/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/destination confirmed/i);
  });
});
