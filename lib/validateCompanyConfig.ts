import type { CompanyConfig } from "@/types";
import type { StellarNetwork } from "@/types/stellar";

export type ConfigCheck = {
  id: string;
  label: string;
  status: "ok" | "error" | "warning";
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  checks: ConfigCheck[];
};

const KNOWN_NETWORKS: StellarNetwork[] = ["TESTNET", "PUBLIC"];

function isStellarAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value);
}

function isSorobanContractId(value: string): boolean {
  return /^C[A-Z2-7]{55}$/.test(value);
}

export function validateCompanyConfig(config: CompanyConfig): ValidationResult {
  const checks: ConfigCheck[] = [];

  // Role assignments — admin
  if (!config.admin) {
    checks.push({
      id: "role-admin-set",
      label: "Admin address",
      status: "error",
      message: "Admin address is not set.",
    });
  } else if (!isStellarAddress(config.admin)) {
    checks.push({
      id: "role-admin-set",
      label: "Admin address",
      status: "error",
      message: "Admin address is not a valid Stellar address (must start with G, 56 chars).",
    });
  } else {
    checks.push({
      id: "role-admin-set",
      label: "Admin address",
      status: "ok",
      message: "Admin address is valid.",
    });
  }

  // Role assignments — treasury
  if (!config.treasury) {
    checks.push({
      id: "role-treasury-set",
      label: "Treasury address",
      status: "error",
      message: "Treasury address is not set.",
    });
  } else if (!isStellarAddress(config.treasury)) {
    checks.push({
      id: "role-treasury-set",
      label: "Treasury address",
      status: "error",
      message: "Treasury address is not a valid Stellar address (must start with G, 56 chars).",
    });
  } else {
    checks.push({
      id: "role-treasury-set",
      label: "Treasury address",
      status: "ok",
      message: "Treasury address is valid.",
    });
  }

  // Role assignments — admin ≠ treasury
  if (config.admin && config.treasury && config.admin === config.treasury) {
    checks.push({
      id: "role-admin-treasury-distinct",
      label: "Admin / treasury distinct",
      status: "error",
      message: "Admin and treasury must not be the same address.",
    });
  } else if (config.admin && config.treasury) {
    checks.push({
      id: "role-admin-treasury-distinct",
      label: "Admin / treasury distinct",
      status: "ok",
      message: "Admin and treasury are different addresses.",
    });
  }

  // Contract IDs
  const contractFields = [
    { key: "registry", label: "Registry contract" },
    { key: "commitment", label: "Commitment contract" },
    { key: "verifier", label: "Verifier contract" },
    { key: "executor", label: "Executor contract" },
    { key: "audit", label: "Audit contract" },
  ] as const;

  for (const { key, label } of contractFields) {
    const value = config.contracts[key];
    if (!value) {
      checks.push({
        id: `contract-${key}`,
        label,
        status: "error",
        message: `${label} ID is not set.`,
      });
    } else if (!isSorobanContractId(value)) {
      checks.push({
        id: `contract-${key}`,
        label,
        status: "error",
        message: `${label} ID is not a valid Soroban contract address (must start with C, 56 chars).`,
      });
    } else {
      checks.push({
        id: `contract-${key}`,
        label,
        status: "ok",
        message: `${label} ID is valid.`,
      });
    }
  }

  // Treasury config — optional token contract
  if (config.tokenContractId !== undefined && config.tokenContractId !== "") {
    if (!isSorobanContractId(config.tokenContractId)) {
      checks.push({
        id: "treasury-token-contract",
        label: "Token contract",
        status: "error",
        message: "Token contract ID is not a valid Soroban contract address (must start with C, 56 chars).",
      });
    } else {
      checks.push({
        id: "treasury-token-contract",
        label: "Token contract",
        status: "ok",
        message: "Token contract ID is valid.",
      });
    }
  }

  // Network selection
  if (!KNOWN_NETWORKS.includes(config.network as StellarNetwork)) {
    checks.push({
      id: "network-known",
      label: "Network",
      status: "error",
      message: `Unknown network "${config.network}". Expected one of: ${KNOWN_NETWORKS.join(", ")}.`,
    });
  } else {
    checks.push({
      id: "network-known",
      label: "Network",
      status: "ok",
      message: `Network is set to ${config.network}.`,
    });

    if (config.network === "PUBLIC") {
      checks.push({
        id: "network-mainnet-confirm",
        label: "Mainnet confirmation",
        status: "warning",
        message: "This configuration targets Stellar Mainnet (PUBLIC). Confirm this is intentional before running payroll.",
      });
    }
  }

  return {
    valid: checks.every((c) => c.status !== "error"),
    checks,
  };
}
