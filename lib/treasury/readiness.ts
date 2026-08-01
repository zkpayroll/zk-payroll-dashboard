import type { StellarNetwork } from "@/stores/walletStore";

/**
 * Status of a single treasury readiness check.
 *
 * - `pass`    – the prerequisite is satisfied; payroll can proceed normally.
 * - `warning` – payroll can still proceed, but we recommend addressing the
 *               flagged item before submitting (e.g. low safety buffer).
 * - `failed`  – payroll is blocked until this item is resolved.
 */
export type ReadinessStatus = "pass" | "warning" | "failed";

export interface ReadinessItem {
  /** Stable identifier so tests / consumers can target a specific check. */
  id:
    | "balance"
    | "asset"
    | "network"
    | "wallet"
    | "permissions";
  /** Short human-readable title shown in the UI. */
  title: string;
  /** Longer description that explains the current state. */
  description: string;
  status: ReadinessStatus;
  /** Optional route the user can visit to resolve a failed check. */
  recoveryHref?: string;
  /** Optional label for the recovery link. */
  recoveryLabel?: string;
}

export interface ReadinessInputs {
  /** Current treasury balance in USDC (or whichever asset payroll uses). */
  balance: number;
  /** Total amount the upcoming payroll run is expected to disburse. */
  projectedPayroll: number;
  /**
   * Minimum safety buffer (in the same unit as `balance`) that should remain
   * after a payroll run. Defaults to $25,000 to match the existing threshold
   * used elsewhere in the dashboard.
   */
  bufferReserve?: number;
  /** Configured Stellar treasury address (public key). */
  treasuryAddress?: string | null;
  /** Network this app is configured to run against. */
  expectedNetwork: StellarNetwork;
  /** Network the connected wallet reports. */
  currentNetwork: StellarNetwork;
  /** Whether the browser has a usable Freighter wallet connection. */
  isWalletConnected: boolean;
  /** Admin public key configured for the company, if any. */
  companyAdmin?: string | null;
  /** Public key of the currently connected wallet, if any. */
  walletPublicKey?: string | null;
}

export interface ReadinessSummary {
  overall: ReadinessStatus;
  items: ReadinessItem[];
}

const DEFAULT_BUFFER_RESERVE = 25_000;

/**
 * Truncate a Stellar public key for compact display while still letting the
 * user recognise the address (`GABCD…WXYZ`).
 */
function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

/**
 * Compute the five treasury readiness checks plus an overall rollup.
 *
 * The function is intentionally pure so it can be unit tested without any
 * DOM, store, or network involvement.
 */
export function computeTreasuryReadiness(
  inputs: ReadinessInputs,
): ReadinessSummary {
  const buffer = inputs.bufferReserve ?? DEFAULT_BUFFER_RESERVE;
  const items: ReadinessItem[] = [];

  // ── 1. Balance ─────────────────────────────────────────────────────────────
  if (inputs.balance < inputs.projectedPayroll) {
    items.push({
      id: "balance",
      title: "Treasury balance covers projected payroll",
      description: `Available balance ($${inputs.balance.toLocaleString()}) is below the projected payroll ($${inputs.projectedPayroll.toLocaleString()}). Fund the treasury before running payroll.`,
      status: "failed",
      recoveryHref: "/treasury",
      recoveryLabel: "Fund treasury",
    });
  } else if (inputs.balance - inputs.projectedPayroll < buffer) {
    items.push({
      id: "balance",
      title: "Treasury balance covers projected payroll",
      description: `Payroll will leave the safety buffer below the recommended $${buffer.toLocaleString()}. Consider topping up before submitting.`,
      status: "warning",
      recoveryHref: "/treasury",
      recoveryLabel: "Top up",
    });
  } else {
    items.push({
      id: "balance",
      title: "Treasury balance covers projected payroll",
      description: `Available balance of $${inputs.balance.toLocaleString()} comfortably covers projected payroll of $${inputs.projectedPayroll.toLocaleString()}.`,
      status: "pass",
    });
  }

  // ── 2. Asset support / treasury address configured ──────────────────────────
  if (!inputs.treasuryAddress) {
    items.push({
      id: "asset",
      title: "Treasury asset configured",
      description:
        "No treasury address is configured for this company. Payroll cannot disburse funds until one is registered.",
      status: "failed",
      recoveryHref: "/setup",
      recoveryLabel: "Configure treasury",
    });
  } else {
    items.push({
      id: "asset",
      title: "Treasury asset configured",
      description: `Treasury address ${shortAddress(inputs.treasuryAddress)} is ready to disburse funds.`,
      status: "pass",
    });
  }

  // ── 3. Network selection ───────────────────────────────────────────────────
  // When the wallet is disconnected we cannot verify the network, so we
  // surface this as a *warning* ("skipped until wallet is connected")
  // rather than another failed row that points at the same `/setup`
  // recovery target as the wallet check. We deliberately omit the
  // recovery CTA on this row so the wallet row remains the single
  // canonical fix-attempt target; payroll is still blocked by the
  // wallet row, which keeps the overall rollup correct without two
  // redundant links competing for the user's attention.
  if (!inputs.isWalletConnected) {
    items.push({
      id: "network",
      title: "Wallet on expected network",
      description:
        "Will be verified automatically once the admin wallet check is resolved.",
      status: "warning",
    });
  } else if (inputs.currentNetwork !== inputs.expectedNetwork) {
    items.push({
      id: "network",
      title: "Wallet on expected network",
      description: `Wallet is on ${inputs.currentNetwork} but this app expects ${inputs.expectedNetwork}. Switch networks in Freighter to continue.`,
      status: "failed",
      recoveryHref: "/setup",
      recoveryLabel: "Switch network",
    });
  } else {
    items.push({
      id: "network",
      title: "Wallet on expected network",
      description: `Wallet is on ${inputs.currentNetwork}, matching the app configuration.`,
      status: "pass",
    });
  }

  // ── 4. Wallet connection ───────────────────────────────────────────────────
  if (!inputs.isWalletConnected) {
    items.push({
      id: "wallet",
      title: "Admin wallet connected",
      description:
        "Payroll submission requires a signed transaction from the admin wallet. Connect Freighter to continue.",
      status: "failed",
      recoveryHref: "/setup",
      recoveryLabel: "Connect wallet",
    });
  } else {
    const pk = inputs.walletPublicKey ?? "connected wallet";
    items.push({
      id: "wallet",
      title: "Admin wallet connected",
      description: `Wallet ${shortAddress(pk)} is connected and ready to sign the payroll transaction.`,
      status: "pass",
    });
  }

  // ── 5. Admin permissions ──────────────────────────────────────────────────
  if (!inputs.companyAdmin) {
    items.push({
      id: "permissions",
      title: "Admin permissions",
      description:
        "No company admin is registered. Register the company to grant payroll authorisation.",
      status: "warning",
      recoveryHref: "/setup",
      recoveryLabel: "Open setup",
    });
  } else if (
    inputs.isWalletConnected &&
    inputs.walletPublicKey &&
    inputs.companyAdmin !== inputs.walletPublicKey
  ) {
    items.push({
      id: "permissions",
      title: "Admin permissions",
      description:
        "The connected wallet does not match the configured admin wallet. Only the admin wallet may authorise payroll submission.",
      status: "failed",
      recoveryHref: "/setup",
      recoveryLabel: "Switch wallet",
    });
  } else {
    items.push({
      id: "permissions",
      title: "Admin permissions",
      description: `Connected wallet matches the registered admin (${shortAddress(inputs.companyAdmin)}).`,
      status: "pass",
    });
  }

  // ── Rollup ────────────────────────────────────────────────────────────────
  let overall: ReadinessStatus = "pass";
  if (items.some((i) => i.status === "failed")) {
    overall = "failed";
  } else if (items.some((i) => i.status === "warning")) {
    overall = "warning";
  }

  return { overall, items };
}
