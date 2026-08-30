import { categorizeSigningError } from "../wallet/signingErrors";
import { categorizeError } from "../../src/errors";

export interface ContractErrorHelp {
  code: string;
  title: string;
  summary: string;
  remediation: string[];
}

/**
 * Known Soroban contract error codes surfaced by the payroll, treasury, and
 * proof-verifier contracts. Codes follow the `Error(Contract, #N)` panic
 * format emitted by soroban-sdk, plus a handful of higher-level failure
 * categories already classified elsewhere in the app (wallet signing,
 * telemetry) so the drawer can explain those too without duplicating logic.
 */
const CONTRACT_ERROR_REGISTRY: Record<string, ContractErrorHelp> = {
  "#1": {
    code: "#1",
    title: "Insufficient treasury balance",
    summary:
      "The payroll contract rejected the disbursement because the treasury balance is lower than the total payroll amount.",
    remediation: [
      "Open Treasury and confirm the available balance covers the projected payroll.",
      "Add funds or reserve funds before retrying the submission.",
      "Re-run the payroll simulation once the balance is topped up.",
    ],
  },
  "#2": {
    code: "#2",
    title: "Invalid or expired proof",
    summary:
      "The zero-knowledge proof attached to this operation failed verification or has expired.",
    remediation: [
      "Check the proof freshness badge on the payroll run for its current status.",
      "Generate a new proof from the Execute Payroll wizard.",
      "Replace the expired proof reference before resubmitting.",
    ],
  },
  "#3": {
    code: "#3",
    title: "Unauthorized signer",
    summary:
      "The connected wallet is not authorized to perform this contract call.",
    remediation: [
      "Confirm the connected wallet matches an admin or operator account.",
      "Ask an admin to grant the required role from the Admin Role Viewer.",
      "Reconnect with the correct Freighter account and retry.",
    ],
  },
  "#4": {
    code: "#4",
    title: "Payroll already executed",
    summary:
      "This payroll run has already been submitted and cannot be executed again.",
    remediation: [
      "Check the payroll run history for the existing transaction.",
      "If this looks unexpected, verify the run ID before starting a new payroll.",
    ],
  },
  "#5": {
    code: "#5",
    title: "Merkle root mismatch",
    summary:
      "The employee commitment set used to generate the proof no longer matches the on-chain merkle root.",
    remediation: [
      "Refresh the employee roster to pick up any recent changes.",
      "Regenerate the payroll proof against the current commitment set.",
    ],
  },
};

/** Fallback shown when the error does not match a known contract code. */
const UNKNOWN_CONTRACT_ERROR: ContractErrorHelp = {
  code: "unknown",
  title: "Unrecognized contract error",
  summary:
    "This error was not recognized as a known payroll contract failure. No sensitive transaction data is shown here.",
  remediation: [
    "Retry the action once — transient RPC issues can surface as generic failures.",
    "Check the Signing Recovery center if the failure happened while signing.",
    "Capture the run ID and escalate to a maintainer if the issue persists.",
  ],
};

// Matches soroban-sdk panic formatting, e.g. "Error(Contract, #3)".
const SOROBAN_ERROR_PATTERN = /Error\(Contract,\s*(#\d+)\)/i;

/**
 * Resolve a caught error (contract panic, signing failure, or generic
 * failure) into a safe, human-readable explanation with remediation steps.
 * Never echoes raw payloads back to the caller.
 */
export function getContractErrorHelp(error: unknown): ContractErrorHelp {
  const message = extractMessage(error);

  const sorobanMatch = message ? SOROBAN_ERROR_PATTERN.exec(message) : null;
  if (sorobanMatch) {
    const code = sorobanMatch[1];
    const known = CONTRACT_ERROR_REGISTRY[code];
    if (known) return known;
  }

  const signing = categorizeSigningError(error);
  if (signing.category !== "unknown") {
    return signingCategoryToHelp(signing.category, signing.label);
  }

  const { category } = categorizeError(error);
  if (category && CONTRACT_ERROR_REGISTRY[category]) {
    return CONTRACT_ERROR_REGISTRY[category];
  }

  return UNKNOWN_CONTRACT_ERROR;
}

function signingCategoryToHelp(
  category: "rejected" | "wrong-network" | "expired-session" | "malformed-transaction",
  label: string,
): ContractErrorHelp {
  switch (category) {
    case "rejected":
      return {
        code: label,
        title: "Wallet signature declined",
        summary: "The Freighter signing prompt was rejected or closed before it completed.",
        remediation: [
          "Review the transaction details and click Retry.",
          "Approve the prompt in Freighter without closing the popup.",
        ],
      };
    case "wrong-network":
      return {
        code: label,
        title: "Wrong wallet network",
        summary: "Freighter's active network does not match the network this dashboard expects.",
        remediation: [
          "Open Freighter → Settings → Network and select the expected network.",
          "Return to the dashboard and retry the action.",
        ],
      };
    case "expired-session":
      return {
        code: label,
        title: "Wallet session expired",
        summary: "Freighter was locked, timed out, or its access grant was revoked.",
        remediation: [
          "Unlock Freighter with your password.",
          "Reconnect from the header button and retry.",
        ],
      };
    case "malformed-transaction":
      return {
        code: label,
        title: "Malformed transaction data",
        summary: "The transaction XDR could not be decoded by the wallet.",
        remediation: [
          "Hard refresh the dashboard (Cmd/Ctrl + Shift + R) and retry.",
          "If it persists, escalate with the run ID — do not retry blindly.",
        ],
      };
  }
}

function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const candidate = error as { message?: unknown };
    if (typeof candidate.message === "string") return candidate.message;
  }
  return null;
}

export { CONTRACT_ERROR_REGISTRY, UNKNOWN_CONTRACT_ERROR };
