import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import PayerAccountStatus from "@/components/features/payroll/PayerAccountStatus";
import { useWalletStore } from "@/stores/walletStore";

vi.mock("@/components/providers/StellarProvider", () => ({
  useOptionalStellar: () => ({
    horizonUrl: "https://horizon.example.test",
    isWrongNetwork: false,
    connect: vi.fn(),
  }),
}));

describe("PayerAccountStatus", () => {
  beforeEach(() => {
    useWalletStore.setState({ publicKey: "GPRIVATEACCOUNT", isConnected: true });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useWalletStore.setState({ publicKey: null, isConnected: false });
  });

  it("reports an active payer account without rendering its address or balance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    render(<PayerAccountStatus />);

    await waitFor(() => expect(screen.getByTestId("payer-account-status")).toHaveAttribute("data-status", "active"));
    expect(screen.getByText("Payer account found")).toBeInTheDocument();
    expect(screen.queryByText("GPRIVATEACCOUNT")).not.toBeInTheDocument();
  });

  it("gives recovery steps when Horizon reports that the payer account is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    render(<PayerAccountStatus />);

    await waitFor(() => expect(screen.getByTestId("payer-account-status")).toHaveAttribute("data-status", "missing"));
    expect(screen.getByText(/fund or activate the payer account/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check again/i })).toBeInTheDocument();
  });

  it("does not claim account health when Horizon returns a server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    render(<PayerAccountStatus />);

    await waitFor(() => expect(screen.getByTestId("payer-account-status")).toHaveAttribute("data-status", "unavailable"));
    expect(screen.getByText(/check the network connection and retry/i)).toBeInTheDocument();
  });

  it("asks the operator to connect when there is no active wallet", () => {
    useWalletStore.setState({ publicKey: null, isConnected: false });
    render(<PayerAccountStatus />);
    expect(screen.getByText("Wallet not connected")).toBeInTheDocument();
  });
});
