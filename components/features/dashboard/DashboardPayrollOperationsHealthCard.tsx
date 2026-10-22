"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  PAYROLL_HEALTH_BAND_LABELS,
  scorePayrollOperationsHealth,
  type PayrollHealthBand,
  type PayrollHealthConfig,
  type PayrollHealthFactorSeverity,
  type PayrollHealthRun,
} from "@/lib/payroll/operationsHealth";
import { useTreasuryStore } from "@/stores/treasury";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

export interface DashboardPayrollOperationsHealthCardProps {
  /** Payroll runs to score. Defaults to the dashboard's payroll run data. */
  runs?: ReadonlyArray<PayrollHealthRun> | null;
  /** Treasury balance. Defaults to the treasury store's available balance. */
  treasuryBalance?: number | null;
  /** Next run amount. Defaults to the treasury store's projected obligation. */
  nextRunAmount?: number | null;
  /** Payroll asset whose treasury balance is read from the store. */
  assetCode?: string;
  /** Reference time for age-based checks (tests). */
  now?: Date;
  config?: Partial<PayrollHealthConfig>;
  /** Number of contributing factors to list. */
  maxFactors?: number;
  className?: string;
}

const HEADING_ID = "payroll-operations-health-heading";

// Each band pairs its colour with a distinct icon and a text label so the
// state never depends on colour alone.
const BAND_STYLES: Record<
  PayrollHealthBand | "insufficient_data",
  { icon: LucideIcon; container: string; iconColor: string; badge: string }
> = {
  healthy: {
    icon: CheckCircle2,
    container: "border-green-200 bg-green-50",
    iconColor: "text-green-700",
    badge: "bg-green-100 text-green-800",
  },
  warning: {
    icon: AlertTriangle,
    container: "border-amber-200 bg-amber-50",
    iconColor: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
  },
  critical: {
    icon: XCircle,
    container: "border-red-200 bg-red-50",
    iconColor: "text-red-700",
    badge: "bg-red-100 text-red-800",
  },
  insufficient_data: {
    icon: HelpCircle,
    container: "border-gray-200 bg-white",
    iconColor: "text-gray-500",
    badge: "bg-gray-100 text-gray-700",
  },
};

const SEVERITY_LABELS: Record<PayrollHealthFactorSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

const SEVERITY_TEXT: Record<PayrollHealthFactorSeverity, string> = {
  critical: "text-red-800",
  warning: "text-amber-800",
  info: "text-gray-700",
};

/**
 * Dashboard card summarising payroll operations health as a 0-100 score with
 * the factors that lowered it (#738).
 */
export default function DashboardPayrollOperationsHealthCard({
  runs,
  treasuryBalance,
  nextRunAmount,
  assetCode = "USDC",
  now,
  config,
  maxFactors = 3,
  className = "",
}: DashboardPayrollOperationsHealthCardProps) {
  const storeBalance = useTreasuryStore((s) => s.balances[assetCode]);

  const resolvedRuns = runs !== undefined ? runs : MOCK_PAYROLL_RUNS;
  const resolvedBalance =
    treasuryBalance !== undefined ? treasuryBalance : storeBalance?.available ?? null;
  const resolvedNextRun =
    nextRunAmount !== undefined ? nextRunAmount : storeBalance?.projected ?? null;

  const result = useMemo(
    () =>
      scorePayrollOperationsHealth(
        {
          runs: resolvedRuns,
          treasuryBalance: resolvedBalance,
          nextRunAmount: resolvedNextRun,
          now,
        },
        config,
      ),
    [resolvedRuns, resolvedBalance, resolvedNextRun, now, config],
  );

  const state = result.kind === "scored" ? result.band : "insufficient_data";
  const styles = BAND_STYLES[state];
  const StatusIcon = styles.icon;
  const topFactors = result.factors.slice(0, Math.max(0, maxFactors));
  const hiddenCount = result.factors.length - topFactors.length;

  return (
    <section
      role={state === "critical" ? "alert" : "status"}
      aria-labelledby={HEADING_ID}
      className={`rounded-lg border p-4 transition-all ${styles.container} ${className}`}
      data-testid="payroll-operations-health"
      data-status={state}
      data-score={result.score ?? ""}
    >
      <div className="flex items-start gap-3">
        <StatusIcon
          className={`mt-0.5 h-5 w-5 shrink-0 ${styles.iconColor}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 id={HEADING_ID} className="text-sm font-semibold text-gray-900">
              Payroll operations health
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}
            >
              {result.kind === "scored"
                ? PAYROLL_HEALTH_BAND_LABELS[result.band]
                : "Insufficient data"}
            </span>
          </div>

          {result.kind === "scored" ? (
            <p className="mt-1 flex items-baseline gap-2 text-sm text-gray-700">
              <Activity className="h-4 w-4 self-center text-gray-500" aria-hidden="true" />
              <span
                className="text-2xl font-semibold text-gray-900"
                data-testid="payroll-operations-health-score"
              >
                {result.score}
              </span>
              <span>
                / 100 across the last {result.runsEvaluated}{" "}
                {result.runsEvaluated === 1 ? "payroll run" : "payroll runs"}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-700">{result.reason}</p>
          )}

          {result.kind === "scored" && result.factors.length === 0 && (
            <p className="mt-2 text-sm text-green-800">
              No issues detected. Recent runs settled and the treasury covers the next run.
            </p>
          )}

          {topFactors.length > 0 && (
            <ul
              className="mt-3 space-y-2"
              aria-label="Factors affecting payroll health"
              data-testid="payroll-operations-health-factors"
            >
              {topFactors.map((factor) => (
                <li
                  key={factor.id}
                  className={`text-sm ${SEVERITY_TEXT[factor.severity]}`}
                  data-factor={factor.id}
                  data-severity={factor.severity}
                >
                  <span className="font-medium">{SEVERITY_LABELS[factor.severity]}: </span>
                  {factor.message}
                  {factor.impact > 0 && (
                    <span className="text-xs text-gray-600"> (-{factor.impact} points)</span>
                  )}
                  {factor.action && (
                    <>
                      {" "}
                      <Link
                        href={factor.action.href}
                        className="rounded font-medium text-gray-900 underline hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                      >
                        {factor.action.label}
                      </Link>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {hiddenCount > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              {hiddenCount} more {hiddenCount === 1 ? "factor" : "factors"} not shown.
            </p>
          )}

          {result.issues.length > 0 && (
            <div className="mt-3" data-testid="payroll-operations-health-issues">
              <p className="text-xs font-medium text-gray-700">Data issues</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {result.issues.map((issue) => (
                  <li key={issue} className="text-xs text-gray-700">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
