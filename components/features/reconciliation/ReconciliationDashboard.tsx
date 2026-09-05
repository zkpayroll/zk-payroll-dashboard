"use client";

import { useMemo } from "react";
import { Loader2, Scale, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { buildReconciliationDashboard, type ReconciliationHealthStatus, type ReconciliationPeriodInput } from "@/lib/sdk/reconciliation";
import { RECONCILIATION_PRIVACY_NOTICE } from "@/lib/privacy/reconciliation";
import { buildMockReconciliationPeriods } from "@/lib/reconciliation/mockDashboardInputs";
import { AssetLiabilityChart } from "./AssetLiabilityChart";
import { PeriodLiabilityCard } from "./PeriodLiabilityCard";

const OVERALL_BANNER: Record<
  ReconciliationHealthStatus,
  { container: string; text: string; icon: React.ComponentType<{ className?: string }>; message: string }
> = {
  healthy: {
    container: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-800",
    icon: CheckCircle2,
    message: "All periods are balanced with no unresolved blockers.",
  },
  warning: {
    container: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    icon: AlertTriangle,
    message: "Some periods still have outstanding balances settling. No hard blockers found.",
  },
  blocked: {
    container: "bg-red-50 border-red-200",
    text: "text-red-800",
    icon: ShieldAlert,
    message: "One or more periods have blocking issues that must be resolved before close.",
  },
};

export interface ReconciliationDashboardProps {
  /** Defaults to the app's mock fixtures. Pass an explicit list (incl. []) for tests/stories. */
  periods?: ReconciliationPeriodInput[];
  isLoading?: boolean;
}

export function ReconciliationDashboard({
  periods = buildMockReconciliationPeriods(),
  isLoading = false,
}: ReconciliationDashboardProps) {
  const summary = useMemo(() => buildReconciliationDashboard(periods), [periods]);

  if (isLoading) {
    return (
      <section aria-labelledby="reconciliation-heading" className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center py-12" role="status" aria-label="Loading reconciliation data">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" aria-hidden="true" />
          <span className="ml-2 text-sm text-gray-500">Loading reconciliation dashboard...</span>
        </div>
      </section>
    );
  }

  if (summary.periods.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No payroll periods to reconcile yet"
        description="Reconciliation data will appear here once a payroll period has been processed."
      />
    );
  }

  const banner = OVERALL_BANNER[summary.overallHealth];
  const BannerIcon = banner.icon;

  return (
    <div className="space-y-6" data-testid="reconciliation-dashboard">
      <div>
        <h2 id="reconciliation-heading" className="text-lg font-semibold text-gray-900">
          Payroll Reconciliation
        </h2>
        <p className="text-sm text-gray-500 mt-1">{RECONCILIATION_PRIVACY_NOTICE}</p>
      </div>

      <div className={`flex items-start gap-3 p-4 rounded-lg border ${banner.container}`} role="status">
        <BannerIcon className={`w-5 h-5 shrink-0 mt-0.5 ${banner.text}`} aria-hidden="true" />
        <div>
          <p className={`text-sm font-medium ${banner.text}`}>
            {summary.totalBlockerCount > 0
              ? `${summary.totalBlockerCount} blocking issue${summary.totalBlockerCount === 1 ? "" : "s"} across ${summary.periods.length} period${summary.periods.length === 1 ? "" : "s"}`
              : `${summary.periods.length} period${summary.periods.length === 1 ? "" : "s"} reviewed`}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">{banner.message}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Liability by asset (all periods)</h3>
        <AssetLiabilityChart assets={summary.assetTotals} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {summary.periods.map((period) => (
          <PeriodLiabilityCard key={period.periodId} period={period} />
        ))}
      </div>
    </div>
  );
}

export default ReconciliationDashboard;
