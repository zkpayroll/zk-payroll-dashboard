"use client";

import { useMemo } from "react";
import {
  History,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  PlusCircle,
  Edit,
  XCircle,
  Settings,
  Globe,
  FileCode,
  Wallet,
  User,
  Shield,
  Coins,
  ArrowUpCircle,
} from "lucide-react";
import { useConfigurationChangeLedger, getChangeTypeLabel, getChangeTypeColor } from "@/stores/configurationChangeLedger";
import { useCompanyStore } from "@/stores/company";
import { usePayrollPolicyStore } from "@/stores/payrollPolicy";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "plus-circle": PlusCircle,
  edit: Edit,
  "x-circle": XCircle,
  settings: Settings,
  globe: Globe,
  "file-code": FileCode,
  wallet: Wallet,
  user: User,
  shield: Shield,
  coins: Coins,
  "arrow-up-circle": ArrowUpCircle,
};

export interface DashboardOrganizationConfigChangeLedgerProps {
  maxEntries?: number;
  className?: string;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatTimestamp(ts);
}

function ConfigChangeIcon({ type, className = "" }: { type: string; className?: string }) {
  const iconName = ICON_MAP[type] || History;
  const colorClass = getChangeTypeColor(type as any);
  const Icon = iconName;

  return (
    <span
      data-testid="config-change-icon"
      className={`flex items-center justify-center w-8 h-8 rounded-full ${colorClass} shrink-0 ring-2 ring-white ${className}`}
      aria-hidden="true"
    >
      <Icon className="w-4 h-4" />
    </span>
  );
}

export default function DashboardOrganizationConfigChangeLedger({
  maxEntries = 10,
  className = "",
}: DashboardOrganizationConfigChangeLedgerProps) {
  const company = useCompanyStore((s) => s.company);
  const policy = usePayrollPolicyStore((s) => s.savedPolicy);
  const { entries, filter, searchQuery, sortDirection, getFilteredEntries, setFilter, setSearchQuery, toggleSortDirection } =
    useConfigurationChangeLedger();

  const filteredEntries = useMemo(() => getFilteredEntries().slice(0, maxEntries), [getFilteredEntries, maxEntries]);

  const changeTypes = useMemo(
    () => Array.from(new Set(entries.map((e) => e.type))).sort(),
    [entries]
  );

  const hasChanges = entries.length > 0;

  if (!hasChanges) {
    return (
      <section aria-labelledby="config-change-ledger-heading" className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h3 id="config-change-ledger-heading" className="text-sm font-semibold text-gray-900">
            Organization Configuration Change Ledger
          </h3>
        </div>
        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-6 text-center">
          <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No configuration changes recorded yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Changes to company settings, payroll policy, and schema migrations will appear here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="config-change-ledger-heading" className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h3 id="config-change-ledger-heading" className="text-sm font-semibold text-gray-900">
            Organization Configuration Change Ledger
          </h3>
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          {entries.length} change{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search changes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              aria-label="Search configuration changes"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="pl-10 pr-8 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none bg-white"
              aria-label="Filter by change type"
            >
              <option value="all">All Changes</option>
              {changeTypes.map((type) => (
                <option key={type} value={type}>
                  {getChangeTypeLabel(type as any)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={toggleSortDirection}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
          >
            {sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{sortDirection === "asc" ? "Oldest first" : "Newest first"}</span>
          </button>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <ol className="space-y-3" aria-label="Configuration change timeline">
            {filteredEntries.map((entry, index) => (
              <li key={entry.id} className="relative">
                {!index && (
                  <span
                    className="absolute left-[1.15rem] top-10 bottom-0 w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start gap-3">
                  <ConfigChangeIcon type={getChangeTypeIcon(entry.type)} />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {getChangeTypeLabel(entry.type)}
                      </span>
                      <span className="text-xs text-gray-400">{formatRelativeTime(entry.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{entry.summary}</p>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          Show details
                        </summary>
                        <pre className="mt-1 text-xs text-gray-600 bg-gray-50 rounded p-2 overflow-auto max-h-32">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </details>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {entry.actor}
                        {entry.actorRole && ` (${entry.actorRole})`}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <History className="w-3 h-3" />
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      {entry.previousVersion && entry.newVersion && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Settings className="w-3 h-3" />
                            v{entry.previousVersion} → v{entry.newVersion}
                          </span>
                        </>
                      )}
                      {entry.schemaVersion && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <ArrowUpCircle className="w-3 h-3" />
                            Schema v{entry.schemaVersion}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {filteredEntries.length < entries.length && (
            <p className="text-center text-xs text-gray-500 mt-3">
              Showing {filteredEntries.length} of {entries.length} changes
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function getChangeTypeIcon(type: string): string {
  const iconMap: Record<string, string> = {
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
  return iconMap[type] || "history";
}