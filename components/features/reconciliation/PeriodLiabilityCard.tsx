"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReconciliationPeriodSummary } from "@/lib/sdk/reconciliation";
import { ReconciliationHealthBadge } from "./ReconciliationHealthBadge";
import { AssetLiabilityChart } from "./AssetLiabilityChart";
import { ReconciliationBlockerPanel } from "./ReconciliationBlockerPanel";

/**
 * One period's liability summary, with drill-down into the payroll runs
 * that make up the period. Only run-level and asset-level aggregates are
 * shown — never a per-employee amount.
 */
export function PeriodLiabilityCard({ period }: { period: ReconciliationPeriodSummary }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
      data-testid={`period-liability-card-${period.periodId}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{period.periodLabel}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {period.assets.map((a) => a.asset.code).join(", ") || "No assets"} ·{" "}
            {period.runs.length} payroll run{period.runs.length === 1 ? "" : "s"}
          </p>
        </div>
        <ReconciliationHealthBadge health={period.health} />
      </div>

      <AssetLiabilityChart assets={period.assets} />

      <ReconciliationBlockerPanel blockersByCategory={period.blockersByCategory} />

      <div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls={`period-runs-${period.periodId}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded"
        >
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
          {isExpanded ? "Hide" : "View"} {period.runs.length} affected payroll run{period.runs.length === 1 ? "" : "s"}
        </button>

        {isExpanded && (
          <ul id={`period-runs-${period.periodId}`} className="mt-3 space-y-2">
            {period.runs.map((run) => (
              <li
                key={run.payrollRunId}
                className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-2.5"
                data-testid={`period-run-row-${run.payrollRunId}`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {run.href ? (
                      <Link href={run.href} className="hover:underline">
                        {run.label}
                      </Link>
                    ) : (
                      run.label
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {run.assets.map((a) => a.asset.code).join(", ")} · {run.blockers.length} blocker
                    {run.blockers.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ReconciliationHealthBadge health={run.health} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default PeriodLiabilityCard;
