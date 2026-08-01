import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import React from "react";
import { useWalletStore } from "@/stores/walletStore";
import { WalletErrorOverlay } from "@/components/providers/WalletErrorOverlay";
import { categorizeSigningError } from "@/lib/wallet/signingErrors";
import { useHelpDrawer } from "@/stores/helpDrawer";

// ── Mock Freighter API ──────────────────────────────────────────────────────

const mockGetNetwork = vi.fn();
const mockGetAddress = vi.fn();
const mockIsConnected = vi.fn();
const mockIsAllowed = vi.fn();
const mockSignTransaction = vi.fn();

vi.mock("@stellar/freighter-api", () => ({
  isConnected: (...args: unknown[]) => mockIsConnected(...args),
  isAllowed: (...args: unknown[]) => mockIsAllowed(...args),
  setAllowed: vi.fn().mockResolvedValue({ isAllowed: true }),
  getAddress: (...args: unknown[]) => mockGetAddress(...args),
  getNetwork: (...args: unknown[]) => mockGetNetwork(...args),
  signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Contract: vi.fn(),
  TransactionBuilder: vi.fn().mockImplementation(() => ({
    addOperation: vi.fn().mockReturnThis(),
    setTimeout: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue({ toXDR: () => "mock-xdr" }),
  })),
  BASE_FEE: "100",
}));

vi.mock("@stellar/stellar-sdk/rpc", () => ({
  Api: { isSimulationError: vi.fn().mockReturnValue(false) },
  assembleTransaction: vi
    .fn()
    .mockReturnValue({ build: () => ({ toXDR: () => "mock-xdr" }) }),
  Server: vi.fn().mockImplementation(() => ({
    getAccount: vi.fn().mockResolvedValue({ accountId: "GXXX", sequence: "0" }),
    simulateTransaction: vi.fn().mockResolvedValue({ result: {} }),
    sendTransaction: vi.fn().mockResolvedValue({ hash: "mock-hash" }),
  })),
}));

beforeEach(() => {
  useWalletStore.getState().reset();
  useHelpDrawer.setState({ isOpen: false, currentPage: null, content: null });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Unit: categorizeSigningError heuristic ─────────────────────────────────

describe("categorizeSigningError", () => {
  it("classifies user rejection phrases as 'rejected'", () => {
    expect(categorizeSigningError("User declined to sign the transaction").category).toBe(
      "rejected"
    );
    expect(categorizeSigningError("Transaction rejected by user").category).toBe(
      "rejected"
    );
    expect(categorizeSigningError("User cancelled the request").category).toBe(
      "rejected"
    );
    expect(categorizeSigningError("user denied signature request").category).toBe(
      "rejected"
    );
  });

  it("classifies session / locked wallet phrases as 'expired-session'", () => {
    expect(categorizeSigningError("Wallet is locked").category).toBe(
      "expired-session"
    );
    expect(categorizeSigningError("Session expired, please re-authenticate").category).toBe(
      "expired-session"
    );
    expect(
      categorizeSigningError("User must allow access to wallet").category
    ).toBe("expired-session");
    expect(categorizeSigningError("Unauthorized: reauth required").category).toBe(
      "expired-session"
    );
  });

  it("classifies XDR / envelope errors as 'malformed-transaction'", () => {
    expect(categorizeSigningError("Invalid XDR: could not decode").category).toBe(
      "malformed-transaction"
    );
    expect(categorizeSigningError("envelope decode error").category).toBe(
      "malformed-transaction"
    );
    expect(categorizeSigningError("malformed transaction envelope").category).toBe(
      "malformed-transaction"
    );
    expect(
      categorizeSigningError("encoding error while building tx").category
    ).toBe("malformed-transaction");
  });

  it("classifies network passphrase mismatches as 'wrong-network'", () => {
    expect(categorizeSigningError("invalid network passphrase").category).toBe(
      "wrong-network"
    );
    expect(
      categorizeSigningError("network passphrase mismatch with chain").category
    ).toBe("wrong-network");
    expect(categorizeSigningError("wrong network").category).toBe(
      "wrong-network"
    );
  });

  it("falls back to 'unknown' for unrecognized messages", () => {
    expect(categorizeSigningError("something completely unrelated").category).toBe(
      "unknown"
    );
    expect(categorizeSigningError(null).category).toBe("unknown");
    expect(categorizeSigningError(undefined).category).toBe("unknown");
  });

  it("handles non-Error throws (e.g. plain objects)", () => {
    expect(
      categorizeSigningError({ message: "User rejected transaction" }).category
    ).toBe("rejected");
  });

  it("classifies 'access denied' and 'permission denied' as 'expired-session', not 'rejected' (#181)", () => {
    // Regression guard: bare "denied" was removed from the user-rejection
    // pattern so auth-layer denials route to session-expired instead of
    // being misclassified as user rejections.
    expect(
      categorizeSigningError("Access denied: please re-authorize wallet").category
    ).toBe("expired-session");
    expect(
      categorizeSigningError("Permission denied for signing operation").category
    ).toBe("expired-session");
    // user-anchored phrases still match the rejection pattern.
    expect(
      categorizeSigningError("User denied the transaction").category
    ).toBe("rejected");
    expect(
      categorizeSigningError("User denied access to the wallet").category
    ).toBe("rejected");
  });
});

// ── WalletErrorOverlay: new signing variants ────────────────────────────────

describe("WalletErrorOverlay: signing failure recovery steps (#181)", () => {
  it("renders rejection-specific recovery for signing-rejected", () => {
    render(
      <WalletErrorOverlay
        type="signing-rejected"
        message="User denied"
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText(/transaction rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/verify the amount/i)).toBeInTheDocument();
    expect(screen.getByText(/re-send the request/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view full recovery guide/i })
    ).toBeInTheDocument();
  });

  it("renders session-expired-specific recovery for session-expired", () => {
    render(
      <WalletErrorOverlay
        type="session-expired"
        message="Wallet locked"
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
    expect(screen.getByText(/unlock it with your password/i)).toBeInTheDocument();
    expect(screen.getByText(/re-connect from the header/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders malformed-tx-specific recovery for malformed-tx", () => {
    render(
      <WalletErrorOverlay
        type="malformed-tx"
        message="Invalid XDR"
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText(/invalid transaction data/i)).toBeInTheDocument();
    expect(screen.getByText(/hard-refresh the dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/private\/incognito window/i)).toBeInTheDocument();
    expect(
      screen.getByText(/do not retry blindly/i, { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("opens the help drawer when 'View full recovery guide' is clicked", () => {
    render(<WalletErrorOverlay type="session-expired" message="Wallet locked" />);
    fireEvent.click(
      screen.getByRole("button", { name: /view full recovery guide/i })
    );
    expect(useHelpDrawer.getState().isOpen).toBe(true);
    expect(useHelpDrawer.getState().content?.title).toMatch(/wallet signing/i);
  });

  it("invokes onRetry when the Retry button is clicked", () => {
    const onRetry = vi.fn();
    render(
      <WalletErrorOverlay
        type="signing-rejected"
        message="User denied"
        onRetry={onRetry}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render the Retry button when the failure is not retryable", () => {
    render(<WalletErrorOverlay type="no-wallet" onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });
});

// ── StellarProvider: signTx routes signing errors to the right overlay ─────

describe("StellarProvider: signTx categorizes signing errors (#181)", () => {
  it.each([
    ["User declined the transaction", /transaction rejected/i],
    ["Wallet session expired", /session expired/i],
    ["xdr decode error: not valid base64", /invalid transaction data/i],
    ["invalid network passphrase", /wrong network/i],
    ["Access denied: please re-authorize", /session expired/i],
    ["Permission denied for signing operation", /session expired/i],
  ])(
    "shows the matching overlay for '%s'",
    async (freighterMessage, expectedOverlayRegex) => {
      const { StellarProvider, useStellar } = await import(
        "@/components/providers/StellarProvider"
      );

      mockIsConnected.mockResolvedValue({ isConnected: true });
      mockIsAllowed.mockResolvedValue({ isAllowed: true });
      mockGetAddress.mockResolvedValue({
        address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      });
      mockGetNetwork.mockResolvedValue({
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
      });
      mockSignTransaction.mockResolvedValue({
        error: { message: freighterMessage },
      });

      let hookResult: any = null;
      function HookConsumer() {
        hookResult = useStellar();
        return null;
      }

      await act(async () => {
        render(
          <StellarProvider>
            <HookConsumer />
          </StellarProvider>
        );
      });

      await waitFor(() => {
        expect(useWalletStore.getState().isLoading).toBe(false);
      });

      await act(async () => {
        await hookResult.signTx("mock-xdr");
      });

      await waitFor(() => {
        expect(screen.getByText(expectedOverlayRegex)).toBeInTheDocument();
      });
    }
  );

  it("routes a thrown signing exception to the matching overlay", async () => {
    const { StellarProvider, useStellar } = await import(
      "@/components/providers/StellarProvider"
    );

    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockIsAllowed.mockResolvedValue({ isAllowed: true });
    mockGetAddress.mockResolvedValue({
      address: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    });
    mockGetNetwork.mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    mockSignTransaction.mockRejectedValue(new Error("User rejected transaction"));

    let hookResult: any = null;
    function HookConsumer() {
      hookResult = useStellar();
      return null;
    }

    await act(async () => {
      render(
        <StellarProvider>
          <HookConsumer />
        </StellarProvider>
      );
    });

    await waitFor(() => {
      expect(useWalletStore.getState().isLoading).toBe(false);
    });

    await act(async () => {
      await hookResult.signTx("mock-xdr");
    });

    await waitFor(() => {
      expect(screen.getByText(/transaction rejected/i)).toBeInTheDocument();
    });
  });
});
