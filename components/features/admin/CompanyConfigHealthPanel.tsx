"use client";

import { useMemo, useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Building2,
  UserCheck,
  Wallet,
  FileCode2,
  Network,
  Shield,
} from "lucide-react";
import type { CompanyConfig, CompanyHealthCheckResult, HealthCheckKey } from "@/types";
import { checkCompanyHealth } from "@/lib/companyHealthCheck";
import { useCompanyStore } from "@/stores/company";
import { MOCK_COMPANY_CONFIG } from "@/lib/api/mockData";

interface CompanyConfigHealthPanelProps {
  config?: CompanyConfig;
  className?: string;
}

const CHECK_ICONS: Record<HealthCheckKey, React.ElementType> = {
  companySetup: Building2,
  adminRole: UserCheck,
  treasuryAccount: Wallet,
  contractIds: FileCode2,
  networkConfig: Network,
  auditSettings: Shield,
};

export function CompanyConfigHealthPanel({
  config: propConfig,
  className = "",
}: CompanyConfigHealthPanelProps) {
  const { company: storeCompany } = useCompanyStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiResult, setApiResult] = useState<CompanyHealthCheckResult | null>(null);

  const activeConfig: Partial<CompanyConfig> = useMemo(() => {
    if (propConfig) return propConfig;
    if (storeCompany) {
      return {
        ...MOCK_COMPANY_CONFIG,
        ...storeCompany,
      };
    }
    return MOCK_COMPANY_CONFIG;
  }, [propConfig, storeCompany]);

  const localResult = useMemo(
    () => checkCompanyHealth(activeConfig),
    [activeConfig],
  );

  const healthResult = apiResult || localResult;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/company/health?companyId=${healthResult.companyId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setApiResult(json.data);
        }
      }
    } catch {
      // Fallback to local computation if fetch fails
      setApiResult(checkCompanyHealth(activeConfig));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Sync local changes to apiResult state if prop or store changes
    setApiResult(checkCompanyHealth(activeConfig));
  }, [activeConfig]);

  const { overallStatus, checks } = healthResult;

  const overallBadgeConfig = {
    healthy: {
      bg: "bg-green-50 text-green-800 border-green-200",
      icon: ShieldCheck,
      iconColor: "text-green-600",
      text: "Healthy — All checks passed",
      subtext: "Your company configuration is ready for payroll execution.",
    },
    warning: {
      bg: "bg-amber-50 text-amber-800 border-amber-200",
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      text: "Warning — Configuration review suggested",
      subtext: "Some non-critical settings require attention before running payroll.",
    },
    failing: {
      bg: "bg-red-50 text-red-800 border-red-200",
      icon: ShieldAlert,
      iconColor: "text-red-600",
      text: "Failing — Action required",
      subtext: "Critical misconfigurations detected that may cause payroll runs to fail.",
    },
  }[overallStatus];

  const StatusHeaderIcon = overallBadgeConfig.icon;

  return (
    <section
      aria-labelledby="company-health-title"
      className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h3
            id="company-health-title"
            className="text-lg font-semibold text-gray-900 flex items-center gap-2"
          >
            Company Configuration Health
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Automated verification of admin roles, treasury links, contract IDs, and audit setup.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
          aria-label="Refresh health check status"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : "text-gray-500"}`}
          />
          Refresh
        </button>
      </div>

      {/* Overall Status Banner */}
      <div
        role="status"
        aria-live="polite"
        className={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${overallBadgeConfig.bg}`}
      >
        <StatusHeaderIcon className={`h-5 w-5 shrink-0 mt-0.5 ${overallBadgeConfig.iconColor}`} />
        <div>
          <h4 className="text-sm font-semibold">{overallBadgeConfig.text}</h4>
          <p className="text-xs mt-0.5 opacity-90">{overallBadgeConfig.subtext}</p>
        </div>
      </div>

      {/* Checks Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {checks.map((check) => {
          const KeyIcon = CHECK_ICONS[check.key] || Shield;

          const isPass = check.status === "pass";
          const isWarning = check.status === "warning";

          const borderClass = isPass
            ? "border-gray-200 bg-gray-50/50"
            : isWarning
              ? "border-amber-200 bg-amber-50/30"
              : "border-red-200 bg-red-50/30";

          const statusBadge = isPass ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3 w-3 text-green-600" /> Pass
            </span>
          ) : isWarning ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-3 w-3 text-amber-600" /> Warning
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              <XCircle className="h-3 w-3 text-red-600" /> Fail
            </span>
          );

          return (
            <div
              key={check.key}
              data-testid={`health-check-${check.key}`}
              className={`flex flex-col justify-between rounded-lg border p-4 transition-all ${borderClass}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-white p-1.5 shadow-xs border border-gray-100">
                      <KeyIcon className="h-4 w-4 text-gray-700" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{check.label}</span>
                  </div>
                  {statusBadge}
                </div>

                <p className="text-xs text-gray-600 leading-relaxed mt-1">{check.message}</p>
              </div>

              {!isPass && check.actionUrl && (
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <a
                    href={check.actionUrl}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Fix in Settings
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default CompanyConfigHealthPanel;
