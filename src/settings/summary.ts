import type { CompanyConfig } from "@/types";

export interface NetworkSummary {
  network: string;
  registryContract: string;
  verifierContract: string;
  executorContract: string;
  auditContract: string;
  commitmentContract: string;
  isConfigured: boolean;
}

export interface AssetSummaryItem {
  code: string;
  contractId?: string;
  isDefault: boolean;
}

export interface TreasurySummary {
  accountAddress: string;
  status: "linked" | "unlinked";
}

export interface RoleSummaryItem {
  role: string;
  assignedCount: number;
  description: string;
}

export interface AuditSettingsSummary {
  enabled: boolean;
  retentionDays: number;
  requireAuditorApproval: boolean;
}

export interface OrganizationPayrollSettingsSummary {
  companyId: string;
  companyName: string;
  isConfigured: boolean;
  network: NetworkSummary;
  assets: AssetSummaryItem[];
  treasury: TreasurySummary;
  roles: RoleSummaryItem[];
  audit: AuditSettingsSummary;
  warnings: string[];
}

export function buildOrganizationPayrollSettingsSummary(
  config: CompanyConfig | null | undefined,
): OrganizationPayrollSettingsSummary {
  if (!config) {
    return {
      companyId: "unknown",
      companyName: "Unconfigured Organization",
      isConfigured: false,
      network: {
        network: "UNSET",
        registryContract: "Unconfigured",
        verifierContract: "Unconfigured",
        executorContract: "Unconfigured",
        auditContract: "Unconfigured",
        commitmentContract: "Unconfigured",
        isConfigured: false,
      },
      assets: [],
      treasury: {
        accountAddress: "Unlinked",
        status: "unlinked",
      },
      roles: [],
      audit: {
        enabled: false,
        retentionDays: 0,
        requireAuditorApproval: false,
      },
      warnings: ["Organization payroll configuration is missing or uninitialized."],
    };
  }

  const warnings: string[] = [];

  const networkConfigured = Boolean(
    config.network &&
      config.contracts?.registry &&
      config.contracts?.verifier &&
      config.contracts?.executor &&
      config.contracts?.audit &&
      config.contracts?.commitment,
  );

  if (!networkConfigured) {
    warnings.push("One or more Soroban contract IDs are missing in the network configuration.");
  }

  const treasuryLinked = Boolean(config.treasury && config.treasury.trim().length > 0);
  if (!treasuryLinked) {
    warnings.push("Treasury account is not linked to this organization.");
  }

  const assets: AssetSummaryItem[] = [
    {
      code: "XLM",
      isDefault: !config.tokenContractId,
    },
  ];

  if (config.tokenContractId) {
    assets.push({
      code: "SAC Token",
      contractId: config.tokenContractId,
      isDefault: true,
    });
  }

  const roles: RoleSummaryItem[] = [
    {
      role: "Admin",
      assignedCount: config.admin ? 1 : 0,
      description: "Full configuration and employee lifecycle access",
    },
    {
      role: "Treasury Operator",
      assignedCount: config.treasury ? 1 : 0,
      description: "Fund reservation and disbursement execution",
    },
    {
      role: "Auditor",
      assignedCount: config.auditSettings?.requireAuditorApproval ? 1 : 0,
      description: "Read-only audit trail and compliance verification",
    },
  ];

  return {
    companyId: config.id,
    companyName: config.name,
    isConfigured: networkConfigured && treasuryLinked,
    network: {
      network: config.network ?? "TESTNET",
      registryContract: config.contracts?.registry || "Unconfigured",
      verifierContract: config.contracts?.verifier || "Unconfigured",
      executorContract: config.contracts?.executor || "Unconfigured",
      auditContract: config.contracts?.audit || "Unconfigured",
      commitmentContract: config.contracts?.commitment || "Unconfigured",
      isConfigured: networkConfigured,
    },
    assets,
    treasury: {
      accountAddress: config.treasury || "Unlinked",
      status: treasuryLinked ? "linked" : "unlinked",
    },
    roles,
    audit: {
      enabled: config.auditSettings?.enabled ?? true,
      retentionDays: config.auditSettings?.retentionDays ?? 90,
      requireAuditorApproval: config.auditSettings?.requireAuditorApproval ?? false,
    },
    warnings,
  };
}
