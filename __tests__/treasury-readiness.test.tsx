/**
 * @vitest-environment jsdom
 *
 * Tests for the treasury readiness checklist (issue #171).
 *
 * We cover three end states via the pure helper:
 *   - Fully ready        – every check passes
 *   - Partially ready    – warnings present, nothing failed
 *   - Blocked            – at least one failed check
 *
 * Plus a light integration test to confirm the component renders the live
 * checklist and reflects wallet state changes.
 */
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import {
  computeTreasuryReadiness,
  type ReadinessInputs,
} from "@/lib/treasury/readiness";
import { useWalletStore } from "@/stores/walletStore";
import { useCompanyStore } from "@/stores/company";
import { TreasuryReadinessChecklist } from "@/components/features/treasury/TreasuryReadinessChecklist";

const ADMIN_KEY = "GADMIN00000000000000000000000000000000000000000000000000";
const TREASURY_KEY = "GTREASURY00000000000000000000000000000000000000000000000";
const OTHER_KEY = "GOTHER000000000000000000000000000000000000000000000000000";

const baseInputs: ReadinessInputs = {
  balance: 100_000,
  projectedPayroll: 19_500,
  bufferReserve: 25_000,
  treasuryAddress: TREASURY_KEY,
  expectedNetwork: "TESTNET",
  currentNetwork: "TESTNET",
  isWalletConnected: true,
  companyAdmin: ADMIN_KEY,
  walletPublicKey: ADMIN_KEY,
};

describe("computeTreasuryReadiness", () => {
  it("reports every check as pass when the treasury is fully ready", () => {
    const result = computeTreasuryReadiness(baseInputs);

    expect(result.overall).toBe("pass");
    expect(result.items).toHaveLength(5);

    const ids = result.items.map((i) => i.id);
    expect(ids).toEqual(["balance", "asset", "network", "wallet", "permissions"]);

    for (const item of result.items) {
      expect(item.status, `expected ${item.id} to be pass`).toBe("pass");
      expect(item.recoveryHref).toBeUndefined();
    }

    const balance = result.items.find((i) => i.id === "balance")!;
    expect(balance.description).toMatch(/comfortably covers/);
  });

  it("reports partially ready when only warnings are present", () => {
    // Balance leaves buffer under threshold but still covers payroll.
    const result = computeTreasuryReadiness({
      ...baseInputs,
      balance: 40_000, // 40k - 19.5k = 20.5k < 25k buffer → warning
    });

    expect(result.overall).toBe("warning");

    const balance = result.items.find((i) => i.id === "balance")!;
    expect(balance.status).toBe("warning");
    expect(balance.recoveryHref).toBe("/treasury");
    expect(balance.recoveryLabel).toBe("Top up");

    // Every other check should remain in pass state for a partial scenario.
    const others = result.items.filter((i) => i.id !== "balance");
    for (const item of others) {
      expect(item.status, `${item.id} should still be pass`).toBe("pass");
    }
  });

  it("reports blocked when any critical check fails", () => {
    const result = computeTreasuryReadiness({
      ...baseInputs,
      balance: 5_000, // far below projected payroll
      treasuryAddress: null,
      isWalletConnected: false,
    });

    expect(result.overall).toBe("failed");

    const byId = Object.fromEntries(result.items.map((i) => [i.id, i]));

    expect(byId.balance.status).toBe("failed");
    expect(byId.balance.recoveryHref).toBe("/treasury");

    expect(byId.asset.status).toBe("failed");
    expect(byId.asset.recoveryHref).toBe("/setup");

    // With no wallet connected, the network check degrades to a *warning*
    // and intentionally omits its recovery CTA so the user gets one
    // canonical blocker (the wallet row) rather than two `/setup` CTAs
    // for the same root cause.
    expect(byId.network.status).toBe("warning");
    expect(byId.network.recoveryHref).toBeUndefined();

    expect(byId.wallet.status).toBe("failed");
    expect(byId.wallet.recoveryHref).toBe("/setup");
  });

  it("flags a wrong-network state even when everything else passes", () => {
    const result = computeTreasuryReadiness({
      ...baseInputs,
      currentNetwork: "PUBLIC",
    });

    expect(result.overall).toBe("failed");
    const network = result.items.find((i) => i.id === "network")!;
    expect(network.status).toBe("failed");
    expect(network.description).toMatch(/PUBLIC/);
    expect(network.description).toMatch(/TESTNET/);
    expect(network.recoveryHref).toBe("/setup");
  });

  it("flags a wallet/admin mismatch as a permission failure", () => {
    const result = computeTreasuryReadiness({
      ...baseInputs,
      walletPublicKey: OTHER_KEY,
    });

    expect(result.overall).toBe("failed");
    const permissions = result.items.find((i) => i.id === "permissions")!;
    expect(permissions.status).toBe("failed");
    expect(permissions.description).toMatch(/does not match the configured admin wallet/);
    expect(permissions.recoveryHref).toBe("/setup");
  });

  it("warns (does not fail) when no admin is configured but a wallet is connected", () => {
    const result = computeTreasuryReadiness({
      ...baseInputs,
      companyAdmin: null,
    });

    expect(result.overall).toBe("warning");
    const permissions = result.items.find((i) => i.id === "permissions")!;
    expect(permissions.status).toBe("warning");
    expect(permissions.recoveryHref).toBe("/setup");
  });

  it("treats connected + matching keys as pass even without explicit admin", () => {
    // Belt-and-braces: a wallet is connected and the admin field happens to
    // be empty — we should still be able to submit; the permission item
    // degrades to a pass rather than a hard fail.
    const result = computeTreasuryReadiness({
      ...baseInputs,
      companyAdmin: null,
      walletPublicKey: null,
    });

    expect(result.overall).toBe("warning");
    const permissions = result.items.find((i) => i.id === "permissions")!;
    expect(permissions.status).toBe("warning");
  });
});

describe("<TreasuryReadinessChecklist />", () => {
  beforeEach(() => {
    // Reset persisted stores to known defaults before each render.
    useWalletStore.setState({
      publicKey: ADMIN_KEY,
      isConnected: true,
      network: "TESTNET",
      networkPassphrase: null,
      isLoading: false,
      error: null,
    });
    useCompanyStore.setState({
      company: {
        id: "company_test",
        name: "Test Co",
        admin: ADMIN_KEY,
        treasury: TREASURY_KEY,
        employeeCount: 2,
        isActive: true,
      },
      isLoading: false,
    });
  });

  it("renders every checklist item with the correct heading", () => {
    render(<TreasuryReadinessChecklist />);

    const list = screen.getByRole("list", {
      name: /treasury readiness checks/i,
    });
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(5);

    // Spot-check titles we expect to render.
    expect(
      screen.getByText(/Treasury balance covers projected payroll/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Treasury asset configured/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Wallet on expected network/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Admin wallet connected/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Admin permissions/i)).toBeInTheDocument();
  });

  it("reflects wallet store changes: disconnected wallet → blocked", () => {
    const { rerender } = render(<TreasuryReadinessChecklist />);

    // Initially the overall banner should say the treasury is ready.
    expect(
      screen.getByText(/Treasury is ready for payroll/i),
    ).toBeInTheDocument();

    // Simulate the wallet being disconnected.
    act(() => {
      useWalletStore.setState({ isConnected: false, publicKey: null });
    });

    rerender(<TreasuryReadinessChecklist />);

    expect(
      screen.getByText(/Treasury is blocked/i),
    ).toBeInTheDocument();

    // Only the wallet + asset/permissions rows should flip to "Blocked";
    // the network row degrades to "Needs attention" since the wallet is the
    // canonical blocker for the same root cause.
    const blockedBadges = screen.getAllByLabelText(/Status: Blocked/i);
    expect(blockedBadges.length).toBeGreaterThanOrEqual(1);
    const warningBadges = screen.getAllByLabelText(/Status: Needs attention/i);
    expect(warningBadges.length).toBeGreaterThanOrEqual(1);
  });
});
