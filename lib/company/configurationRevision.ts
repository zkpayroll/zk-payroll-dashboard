import { z } from "zod";
import type { Company, CompanyConfig } from "@/types";

/** Setup can save a company before the network and contracts are configured. */
export type CompanyConfiguration = Company &
  Partial<Omit<CompanyConfig, keyof Company>>;

export const CONFIGURATION_FIELD_LABELS = {
  name: "Company name",
  admin: "Admin wallet",
  treasury: "Treasury wallet",
  isActive: "Company active status",
  network: "Stellar network",
  tokenContractId: "Token contract",
  "contracts.registry": "Registry contract",
  "contracts.commitment": "Commitment contract",
  "contracts.verifier": "Verifier contract",
  "contracts.executor": "Executor contract",
  "contracts.audit": "Audit contract",
  "auditSettings.enabled": "Audit logging",
  "auditSettings.retentionDays": "Audit retention",
  "auditSettings.requireAuditorApproval": "Auditor approval",
} as const;
export type ConfigurationField = keyof typeof CONFIGURATION_FIELD_LABELS;
export type ConfigurationSnapshot = Partial<Record<ConfigurationField, string>>;
export interface CompanyConfigurationRevision {
  id: string;
  companyId: string;
  version: number;
  timestamp: string;
  kind: "baseline" | "updated";
  changedFields: ConfigurationField[];
}
export interface ConfigurationTrackingState {
  configurationSnapshots: Record<string, ConfigurationSnapshot>;
  configurationRevisions: Record<string, CompanyConfigurationRevision[]>;
}
export const MAX_CONFIGURATION_REVISIONS = 50;

/** Compare an explicit allowlist, never payroll data or arbitrary object keys. */
export function configurationSnapshot(
  company: CompanyConfiguration,
): ConfigurationSnapshot {
  const snapshot: ConfigurationSnapshot = {};
  for (const field of Object.keys(
    CONFIGURATION_FIELD_LABELS,
  ) as ConfigurationField[]) {
    const [parent, child] = field.split(".");
    let value: unknown;
    if (parent === "contracts")
      value =
        company.contracts?.[
          child as keyof NonNullable<CompanyConfiguration["contracts"]>
        ];
    else if (parent === "auditSettings")
      value =
        company.auditSettings?.[
          child as keyof NonNullable<CompanyConfiguration["auditSettings"]>
        ];
    else value = company[parent as keyof CompanyConfiguration];
    if (field === "tokenContractId" && value === "") value = undefined;
    if (["string", "boolean", "number"].includes(typeof value))
      snapshot[field] = JSON.stringify(value);
  }
  return snapshot;
}

export function trackConfiguration(
  state: ConfigurationTrackingState,
  company: CompanyConfiguration,
  timestamp = new Date().toISOString(),
): ConfigurationTrackingState {
  const previous = Object.hasOwn(state.configurationSnapshots, company.id)
    ? state.configurationSnapshots[company.id]
    : undefined;
  const history = Object.hasOwn(state.configurationRevisions, company.id)
    ? state.configurationRevisions[company.id]
    : [];
  const snapshot = configurationSnapshot(company);
  const changedFields = (
    Object.keys(CONFIGURATION_FIELD_LABELS) as ConfigurationField[]
  ).filter((field) => snapshot[field] !== previous?.[field]);
  if (previous && changedFields.length === 0) return state;
  const version = (history[0]?.version ?? 0) + 1;
  const revision: CompanyConfigurationRevision = {
    id: `${company.id}:${version}`,
    companyId: company.id,
    version,
    timestamp,
    kind: history.length === 0 ? "baseline" : "updated",
    changedFields,
  };
  return {
    configurationSnapshots: {
      ...state.configurationSnapshots,
      [company.id]: snapshot,
    },
    configurationRevisions: {
      ...state.configurationRevisions,
      [company.id]: [revision, ...history].slice(
        0,
        MAX_CONFIGURATION_REVISIONS,
      ),
    },
  };
}

const wallet = z
  .string()
  .regex(
    /^G[A-Z2-7]{55}$/,
    "Use a 56-character Stellar wallet address starting with G.",
  );
const contract = z
  .string()
  .regex(
    /^C[A-Z2-7]{55}$/,
    "Use a 56-character Soroban contract ID starting with C.",
  );
const configurationSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(128)
      .refine(
        (id) => id === id.trim(),
        "Company ID must not contain leading or trailing whitespace.",
      ),
    name: z.string().trim().min(1).max(200),
    admin: wallet,
    treasury: wallet,
    employeeCount: z.number().int().nonnegative(),
    isActive: z.boolean(),
    network: z.enum(["TESTNET", "PUBLIC"]).optional(),
    contracts: z
      .object({
        registry: contract,
        commitment: contract,
        verifier: contract,
        executor: contract,
        audit: contract,
      })
      .optional(),
    tokenContractId: z.union([contract, z.literal("")]).optional(),
    auditSettings: z
      .object({
        enabled: z.boolean(),
        retentionDays: z.number().int().min(1).max(36500).optional(),
        requireAuditorApproval: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((config) => config.admin !== config.treasury, {
    message: "Admin and treasury must use different wallets.",
    path: ["treasury"],
  })
  .refine((config) => Boolean(config.network) === Boolean(config.contracts), {
    message: "Configure the network and all five contracts together.",
    path: ["contracts"],
  });

export type ConfigurationUpdateResult =
  | { ok: true; version: number }
  | { ok: false; code: "invalid" | "conflict"; message: string };

export function validateConfigurationUpdate(config: CompanyConfiguration) {
  return configurationSchema.safeParse(config);
}
