import type { StellarNetwork } from "@/stores/walletStore";

export type FundingSourceType = "treasury" | "wallet" | "pending_funding";

export type FundingSourceStatus = "ready" | "warning" | "blocked" | "unknown";

export interface FundingSource {
  type: FundingSourceType;
  label: string;
  status: FundingSourceStatus;
  available: number;
  required: number;
  message: string;
  recoveryHref?: string;
  recoveryLabel?: string;
}

export interface FundingSourceReadinessResult {
  overall: FundingSourceStatus;
  sources: FundingSource[];
  totalAvailable: number;
  totalRequired: number;
  shortfall: number;
  canProceed: boolean;
}

export interface FundingSourceReadinessInputs {
  treasuryBalance: number;
  projectedPayroll: number;
  walletBalance?: number | null;
  pendingFundingAmount?: number | null;
  treasuryAddress?: string | null;
  isWalletConnected: boolean;
  walletPublicKey?: string | null;
  companyAdmin?: string | null;
  expectedNetwork: StellarNetwork;
  currentNetwork: StellarNetwork;
  bufferReserve?: number;
}

const DEFAULT_BUFFER_RESERVE = 25_000;

function evaluateTreasurySource(
  inputs: FundingSourceReadinessInputs,
): FundingSource {
  const buffer = inputs.bufferReserve ?? DEFAULT_BUFFER_RESERVE;

  if (!inputs.treasuryAddress) {
    return {
      type: "treasury",
      label: "Treasury balance",
      status: "blocked",
      available: 0,
      required: inputs.projectedPayroll,
      message:
        "No treasury address is configured. Fund the treasury before running payroll.",
      recoveryHref: "/setup",
      recoveryLabel: "Configure treasury",
    };
  }

  if (inputs.treasuryBalance < inputs.projectedPayroll) {
    return {
      type: "treasury",
      label: "Treasury balance",
      status: "blocked",
      available: inputs.treasuryBalance,
      required: inputs.projectedPayroll,
      message: `Treasury balance ($${inputs.treasuryBalance.toLocaleString()}) is below the projected payroll ($${inputs.projectedPayroll.toLocaleString()}). Fund the treasury before running payroll.`,
      recoveryHref: "/treasury",
      recoveryLabel: "Fund treasury",
    };
  }

  if (inputs.treasuryBalance - inputs.projectedPayroll < buffer) {
    return {
      type: "treasury",
      label: "Treasury balance",
      status: "warning",
      available: inputs.treasuryBalance,
      required: inputs.projectedPayroll,
      message: `Payroll will leave the treasury below the recommended safety buffer of $${buffer.toLocaleString()}. Consider topping up before submitting.`,
      recoveryHref: "/treasury",
      recoveryLabel: "Top up",
    };
  }

  return {
    type: "treasury",
    label: "Treasury balance",
    status: "ready",
    available: inputs.treasuryBalance,
    required: inputs.projectedPayroll,
    message: `Treasury balance of $${inputs.treasuryBalance.toLocaleString()} comfortably covers projected payroll.`,
  };
}

function evaluateWalletSource(
  inputs: FundingSourceReadinessInputs,
): FundingSource {
  if (!inputs.isWalletConnected) {
    return {
      type: "wallet",
      label: "Wallet connection",
      status: "blocked",
      available: 0,
      required: 0,
      message:
        "No wallet is connected. Connect Freighter to authorize payroll submission.",
      recoveryHref: "/setup",
      recoveryLabel: "Connect wallet",
    };
  }

  if (inputs.currentNetwork !== inputs.expectedNetwork) {
    return {
      type: "wallet",
      label: "Wallet connection",
      status: "blocked",
      available: 0,
      required: 0,
      message: `Wallet is on ${inputs.currentNetwork} but this app expects ${inputs.expectedNetwork}. Switch networks in Freighter to continue.`,
      recoveryHref: "/setup",
      recoveryLabel: "Switch network",
    };
  }

  if (
    inputs.companyAdmin &&
    inputs.walletPublicKey &&
    inputs.companyAdmin !== inputs.walletPublicKey
  ) {
    return {
      type: "wallet",
      label: "Wallet connection",
      status: "blocked",
      available: 0,
      required: 0,
      message:
        "The connected wallet does not match the configured admin wallet. Only the admin wallet may authorize payroll submission.",
      recoveryHref: "/setup",
      recoveryLabel: "Switch wallet",
    };
  }

  const walletBal = inputs.walletBalance ?? 0;
  if (walletBal < 1) {
    return {
      type: "wallet",
      label: "Wallet connection",
      status: "warning",
      available: walletBal,
      required: 0,
      message:
        "Wallet is connected but has a very low XLM balance. Transaction fees may fail.",
    };
  }

  return {
    type: "wallet",
    label: "Wallet connection",
    status: "ready",
    available: walletBal,
    required: 0,
    message: "Wallet is connected, on the correct network, and ready to sign.",
  };
}

function evaluatePendingFundingSource(
  inputs: FundingSourceReadinessInputs,
): FundingSource {
  const pending = inputs.pendingFundingAmount ?? 0;

  if (pending <= 0) {
    return {
      type: "pending_funding",
      label: "Pending funding",
      status: "unknown",
      available: 0,
      required: 0,
      message: "No pending funding transactions detected.",
    };
  }

  return {
    type: "pending_funding",
    label: "Pending funding",
    status: "warning",
    available: pending,
    required: 0,
    message: `A pending funding transaction of $${pending.toLocaleString()} was detected. Confirm it has been processed before running payroll.`,
  };
}

export function computeFundingSourceReadiness(
  inputs: FundingSourceReadinessInputs,
): FundingSourceReadinessResult {
  const sources: FundingSource[] = [
    evaluateTreasurySource(inputs),
    evaluateWalletSource(inputs),
    evaluatePendingFundingSource(inputs),
  ];

  const totalAvailable = sources.reduce((sum, s) => sum + s.available, 0);
  const totalRequired = inputs.projectedPayroll;
  const shortfall = Math.max(0, totalRequired - totalAvailable);

  let overall: FundingSourceStatus = "ready";
  if (sources.some((s) => s.status === "blocked")) {
    overall = "blocked";
  } else if (sources.some((s) => s.status === "warning")) {
    overall = "warning";
  }

  const canProceed = overall !== "blocked" && shortfall <= 0;

  return {
    overall,
    sources,
    totalAvailable,
    totalRequired,
    shortfall,
    canProceed,
  };
}
