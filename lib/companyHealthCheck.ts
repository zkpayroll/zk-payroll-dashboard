import type {
  CompanyConfig,
  CompanyHealthCheckResult,
  CompanyHealthCheckItem,
} from "@/types";

export function isStellarAddress(value?: string): boolean {
  if (!value) return false;
  return /^G[A-Z2-7]{55}$/.test(value);
}

export function isSorobanContractId(value?: string): boolean {
  if (!value) return false;
  return /^C[A-Z2-7]{55}$/.test(value);
}

export function checkCompanyHealth(
  config?: Partial<CompanyConfig> | null,
): CompanyHealthCheckResult {
  const companyId = config?.id || "unknown";
  const timestamp = new Date().toISOString();
  const checks: CompanyHealthCheckItem[] = [];

  // 1. Company setup check
  if (config?.name && config?.id && config?.isActive !== false) {
    checks.push({
      key: "companySetup",
      label: "Company Setup",
      status: "pass",
      message: "Company profile complete and active.",
      actionUrl: "/setup",
    });
  } else if (config?.isActive === false) {
    checks.push({
      key: "companySetup",
      label: "Company Setup",
      status: "fail",
      message: "Company status is currently inactive.",
      actionUrl: "/setup",
    });
  } else {
    checks.push({
      key: "companySetup",
      label: "Company Setup",
      status: "fail",
      message: "Company onboarding incomplete — missing required setup fields.",
      actionUrl: "/setup",
    });
  }

  // 2. Admin role check
  if (!config?.admin) {
    checks.push({
      key: "adminRole",
      label: "Admin Role",
      status: "fail",
      message: "Admin address not assigned.",
      actionUrl: "/setup",
    });
  } else if (!isStellarAddress(config.admin)) {
    checks.push({
      key: "adminRole",
      label: "Admin Role",
      status: "fail",
      message: "Admin address is not a valid Stellar public key (must start with G, 56 characters).",
      actionUrl: "/setup",
    });
  } else {
    checks.push({
      key: "adminRole",
      label: "Admin Role",
      status: "pass",
      message: "Active admin role assigned with valid Stellar address.",
      actionUrl: "/setup",
    });
  }

  // 3. Treasury account check
  if (!config?.treasury) {
    checks.push({
      key: "treasuryAccount",
      label: "Treasury Account",
      status: "fail",
      message: "Treasury account not linked — go to Settings > Treasury.",
      actionUrl: "/treasury",
    });
  } else if (!isStellarAddress(config.treasury)) {
    checks.push({
      key: "treasuryAccount",
      label: "Treasury Account",
      status: "fail",
      message: "Treasury account is not a valid Stellar public key.",
      actionUrl: "/treasury",
    });
  } else if (config.admin && config.treasury === config.admin) {
    checks.push({
      key: "treasuryAccount",
      label: "Treasury Account",
      status: "fail",
      message: "Treasury account must be distinct from admin address — go to Settings > Treasury.",
      actionUrl: "/treasury",
    });
  } else {
    checks.push({
      key: "treasuryAccount",
      label: "Treasury Account",
      status: "pass",
      message: "Treasury account set and verified.",
      actionUrl: "/treasury",
    });
  }

  // 4. Contract IDs check
  const requiredContracts = [
    "registry",
    "commitment",
    "verifier",
    "executor",
    "audit",
  ] as const;

  const missingOrInvalid: string[] = [];
  if (config?.contracts) {
    for (const key of requiredContracts) {
      if (!isSorobanContractId(config.contracts[key])) {
        missingOrInvalid.push(key);
      }
    }
    if (config.tokenContractId && !isSorobanContractId(config.tokenContractId)) {
      missingOrInvalid.push("tokenContractId");
    }
  } else {
    missingOrInvalid.push(...requiredContracts);
  }

  if (missingOrInvalid.length > 0) {
    checks.push({
      key: "contractIds",
      label: "Contract IDs",
      status: "fail",
      message: `Contract IDs missing or invalid: ${missingOrInvalid.join(", ")}.`,
      actionUrl: "/compliance",
    });
  } else {
    checks.push({
      key: "contractIds",
      label: "Contract IDs",
      status: "pass",
      message: "All required Soroban contract IDs are present and valid.",
      actionUrl: "/compliance",
    });
  }

  // 5. Network config check
  if (config?.network === "TESTNET") {
    checks.push({
      key: "networkConfig",
      label: "Network Config",
      status: "pass",
      message: "Network configuration is active on Stellar TESTNET.",
      actionUrl: "/compliance",
    });
  } else if (config?.network === "PUBLIC") {
    checks.push({
      key: "networkConfig",
      label: "Network Config",
      status: "warning",
      message: "Network configuration targets Stellar Mainnet (PUBLIC). Confirm this is intentional.",
      actionUrl: "/compliance",
    });
  } else {
    checks.push({
      key: "networkConfig",
      label: "Network Config",
      status: "fail",
      message: "Network configuration is invalid or missing — expected TESTNET or PUBLIC.",
      actionUrl: "/compliance",
    });
  }

  // 6. Audit settings check
  const hasAuditContract = isSorobanContractId(config?.contracts?.audit);
  const isAuditEnabled = config?.auditSettings?.enabled !== false;

  if (hasAuditContract && isAuditEnabled) {
    checks.push({
      key: "auditSettings",
      label: "Audit Settings",
      status: "pass",
      message: "Audit contract and logging settings are active.",
      actionUrl: "/compliance",
    });
  } else if (hasAuditContract && !isAuditEnabled) {
    checks.push({
      key: "auditSettings",
      label: "Audit Settings",
      status: "warning",
      message: "Audit contract is set, but audit logging is disabled in settings.",
      actionUrl: "/compliance",
    });
  } else {
    checks.push({
      key: "auditSettings",
      label: "Audit Settings",
      status: "fail",
      message: "Audit settings or audit contract missing — configure audit settings.",
      actionUrl: "/compliance",
    });
  }

  const hasFail = checks.some((c) => c.status === "fail");
  const hasWarning = checks.some((c) => c.status === "warning");
  const overallStatus: CompanyHealthCheckResult["overallStatus"] = hasFail
    ? "failing"
    : hasWarning
      ? "warning"
      : "healthy";

  return {
    companyId,
    overallStatus,
    checks,
    timestamp,
  };
}
