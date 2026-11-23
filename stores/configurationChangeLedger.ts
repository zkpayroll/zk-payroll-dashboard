import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CompanyConfig } from "@/types";

export type ConfigChangeType =
  | "company_created"
  | "company_updated"
  | "company_deactivated"
  | "policy_updated"
  | "network_changed"
  | "contracts_updated"
  | "treasury_updated"
  | "admin_updated"
  | "audit_settings_updated"
  | "token_contract_updated"
  | "schema_migrated";

export interface ConfigChangeEntry {
  id: string;
  type: ConfigChangeType;
  timestamp: string;
  actor: string;
  actorRole?: string;
  summary: string;
  details?: Record<string, unknown>;
  previousVersion?: number;
  newVersion?: number;
  schemaVersion?: number;
}

export type ConfigChangeFilter =
  | "all"
  | ConfigChangeType;

export interface ConfigChangeLedgerState {
  entries: ConfigChangeEntry[];
  filter: ConfigChangeFilter;
  searchQuery: string;
  sortDirection: "asc" | "desc";

  recordChange: (entry: Omit<ConfigChangeEntry, "id" | "timestamp">) => ConfigChangeEntry;
  recordCompanyConfigChange: (
    previousConfig: CompanyConfig | null,
    newConfig: CompanyConfig,
    actor: string,
    actorRole?: string
  ) => ConfigChangeEntry[];
  recordPolicyChange: (
    previousVersion: number,
    newVersion: number,
    actor: string,
    actorRole?: string,
    details?: Record<string, unknown>
  ) => ConfigChangeEntry;
  recordSchemaMigration: (
    previousSchemaVersion: number,
    newSchemaVersion: number,
    actor: string,
    actorRole?: string
  ) => ConfigChangeEntry;

  setFilter: (filter: ConfigChangeFilter) => void;
  setSearchQuery: (query: string) => void;
  toggleSortDirection: () => void;
  getFilteredEntries: () => ConfigChangeEntry[];
  getEntriesByType: (type: ConfigChangeType) => ConfigChangeEntry[];
  clearEntries: () => void;
  reset: () => void;
}

const initialState = {
  entries: [] as ConfigChangeEntry[],
  filter: "all" as ConfigChangeFilter,
  searchQuery: "",
  sortDirection: "desc" as "asc" | "desc",
};

function generateId(): string {
  return `config_change_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function diffConfigs(
  previous: CompanyConfig | null,
  current: CompanyConfig
): Array<{ type: ConfigChangeType; summary: string; details: Record<string, unknown> }> {
  const changes: Array<{ type: ConfigChangeType; summary: string; details: Record<string, unknown> }> = [];

  if (!previous) {
    changes.push({
      type: "company_created",
      summary: `Company "${current.name}" created with initial configuration`,
      details: {
        companyId: current.id,
        network: current.network,
        admin: current.admin,
        treasury: current.treasury,
        contractCount: Object.keys(current.contracts).length,
      },
    });
    return changes;
  }

  if (previous.name !== current.name) {
    changes.push({
      type: "company_updated",
      summary: `Company name changed from "${previous.name}" to "${current.name}"`,
      details: { previousName: previous.name, newName: current.name },
    });
  }

  if (previous.admin !== current.admin) {
    changes.push({
      type: "admin_updated",
      summary: `Admin address updated`,
      details: { previousAdmin: previous.admin, newAdmin: current.admin },
    });
  }

  if (previous.treasury !== current.treasury) {
    changes.push({
      type: "treasury_updated",
      summary: `Treasury address updated`,
      details: { previousTreasury: previous.treasury, newTreasury: current.treasury },
    });
  }

  if (previous.network !== current.network) {
    changes.push({
      type: "network_changed",
      summary: `Network changed from ${previous.network} to ${current.network}`,
      details: { previousNetwork: previous.network, newNetwork: current.network },
    });
  }

  const prevContracts = (previous.contracts || {}) as unknown as Record<string, string>;
  const currContracts = (current.contracts || {}) as unknown as Record<string, string>;
  const contractKeys = Array.from(new Set([...Object.keys(prevContracts), ...Object.keys(currContracts)]));

  for (const key of contractKeys) {
    if (prevContracts[key] !== currContracts[key]) {
      changes.push({
        type: "contracts_updated",
        summary: `${key.charAt(0).toUpperCase() + key.slice(1)} contract updated`,
        details: {
          contractType: key,
          previous: prevContracts[key] || "unset",
          current: currContracts[key] || "unset",
        },
      });
    }
  }

  if (previous.tokenContractId !== current.tokenContractId) {
    changes.push({
      type: "token_contract_updated",
      summary: `Token contract ${previous.tokenContractId ? "updated" : current.tokenContractId ? "added" : "removed"}`,
      details: {
        previousTokenContract: previous.tokenContractId || "none",
        newTokenContract: current.tokenContractId || "none",
      },
    });
  }

  const prevAudit = previous.auditSettings || {} as { enabled?: boolean; retentionDays?: number; requireAuditorApproval?: boolean };
  const currAudit = current.auditSettings || {} as { enabled?: boolean; retentionDays?: number; requireAuditorApproval?: boolean };

  if (prevAudit.enabled !== currAudit.enabled) {
    changes.push({
      type: "audit_settings_updated",
      summary: `Audit ${currAudit.enabled ? "enabled" : "disabled"}`,
      details: { previous: prevAudit.enabled, current: currAudit.enabled },
    });
  }

  if (prevAudit.retentionDays !== currAudit.retentionDays) {
    changes.push({
      type: "audit_settings_updated",
      summary: `Audit retention period changed from ${prevAudit.retentionDays || "default"} to ${currAudit.retentionDays || "default"} days`,
      details: { previousRetentionDays: prevAudit.retentionDays, newRetentionDays: currAudit.retentionDays },
    });
  }

  if (prevAudit.requireAuditorApproval !== currAudit.requireAuditorApproval) {
    changes.push({
      type: "audit_settings_updated",
      summary: `Auditor approval requirement ${currAudit.requireAuditorApproval ? "enabled" : "disabled"}`,
      details: { previousRequireAuditorApproval: prevAudit.requireAuditorApproval, newRequireAuditorApproval: currAudit.requireAuditorApproval },
    });
  }

  if (previous.isActive !== current.isActive) {
    changes.push({
      type: current.isActive ? "company_updated" : "company_deactivated",
      summary: current.isActive ? "Company reactivated" : "Company deactivated",
      details: { previousActive: previous.isActive, newActive: current.isActive },
    });
  }

  return changes;
}

export const useConfigurationChangeLedger = create<ConfigChangeLedgerState>()(
  persist(
    (set, get) => ({
      ...initialState,

      recordChange: (entryData) => {
        const entry: ConfigChangeEntry = {
          ...entryData,
          id: generateId(),
          timestamp: new Date().toISOString(),
        };
        set((state) => ({ entries: [entry, ...state.entries].slice(0, 500) }));
        return entry;
      },

      recordCompanyConfigChange: (previousConfig, newConfig, actor, actorRole) => {
        const changes = diffConfigs(previousConfig, newConfig);
        const newEntries: ConfigChangeEntry[] = [];

        for (const change of changes) {
          const entry = get().recordChange({
            ...change,
            actor,
            actorRole,
            schemaVersion: newConfig.configSchemaVersion,
          });
          newEntries.push(entry);
        }

        return newEntries;
      },

      recordPolicyChange: (previousVersion, newVersion, actor, actorRole, details) => {
        return get().recordChange({
          type: "policy_updated",
          summary: `Payroll policy updated from version ${previousVersion} to ${newVersion}`,
          actor,
          actorRole,
          details: {
            previousVersion,
            newVersion,
            ...details,
          },
          previousVersion,
          newVersion,
        });
      },

      recordSchemaMigration: (previousSchemaVersion, newSchemaVersion, actor, actorRole) => {
        return get().recordChange({
          type: "schema_migrated",
          summary: `Organization configuration schema migrated from version ${previousSchemaVersion} to ${newSchemaVersion}`,
          actor,
          actorRole,
          details: {
            previousSchemaVersion,
            newSchemaVersion,
          },
          schemaVersion: newSchemaVersion,
        });
      },

      setFilter: (filter) => set({ filter }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      toggleSortDirection: () =>
        set((state) => ({
          sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
        })),

      getFilteredEntries: () => {
        const { entries, filter, searchQuery, sortDirection } = get();
        let filtered = [...entries];

        if (filter !== "all") {
          filtered = filtered.filter((e) => e.type === filter);
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (e) =>
              e.summary.toLowerCase().includes(q) ||
              e.actor.toLowerCase().includes(q) ||
              (e.actorRole?.toLowerCase().includes(q) ?? false) ||
              JSON.stringify(e.details).toLowerCase().includes(q)
          );
        }

        filtered.sort((a, b) => {
          const cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          return sortDirection === "asc" ? cmp : -cmp;
        });

        return filtered;
      },

      getEntriesByType: (type) => {
        const { entries } = get();
        return entries.filter((e) => e.type === type);
      },

      clearEntries: () => set({ entries: [] }),
      reset: () => set(initialState),
    }),
    {
      name: "zk-configuration-change-ledger",
      partialize: (state) => ({
        entries: state.entries,
      }),
    }
  )
);

export function getChangeTypeLabel(type: ConfigChangeType): string {
  const labels: Record<ConfigChangeType, string> = {
    company_created: "Company Created",
    company_updated: "Company Updated",
    company_deactivated: "Company Deactivated",
    policy_updated: "Policy Updated",
    network_changed: "Network Changed",
    contracts_updated: "Contracts Updated",
    treasury_updated: "Treasury Updated",
    admin_updated: "Admin Updated",
    audit_settings_updated: "Audit Settings Updated",
    token_contract_updated: "Token Contract Updated",
    schema_migrated: "Schema Migrated",
  };
  return labels[type];
}

export function getChangeTypeIcon(type: ConfigChangeType): string {
  const icons: Record<ConfigChangeType, string> = {
    company_created: "plus-circle",
    company_updated: "edit",
    company_deactivated: "x-circle",
    policy_updated: "settings",
    network_changed: "globe",
    contracts_updated: "file-code",
    treasury_updated: "wallet",
    admin_updated: "user",
    audit_settings_updated: "shield",
    token_contract_updated: "coins",
    schema_migrated: "arrow-up-circle",
  };
  return icons[type];
}

export function getChangeTypeColor(type: ConfigChangeType): string {
  const colors: Record<ConfigChangeType, string> = {
    company_created: "text-green-600 bg-green-50",
    company_updated: "text-blue-600 bg-blue-50",
    company_deactivated: "text-gray-600 bg-gray-100",
    policy_updated: "text-indigo-600 bg-indigo-50",
    network_changed: "text-purple-600 bg-purple-50",
    contracts_updated: "text-orange-600 bg-orange-50",
    treasury_updated: "text-emerald-600 bg-emerald-50",
    admin_updated: "text-sky-600 bg-sky-50",
    audit_settings_updated: "text-red-600 bg-red-50",
    token_contract_updated: "text-amber-600 bg-amber-50",
    schema_migrated: "text-violet-600 bg-violet-50",
  };
  return colors[type];
}