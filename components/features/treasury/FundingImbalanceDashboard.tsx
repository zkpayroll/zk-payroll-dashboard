"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Landmark,
  PiggyBank,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MOCK_MULTI_ASSET_RUNS } from "@/lib/api/mockData";
import { formatAssetAmount } from "@/lib/payroll/multiAsset";
import {
  computeFundingPositions,
  type AssetFundingPosition,
  type AssetFundingState,
} from "@/lib/treasury/fundingBalance";

const STATE_CONFIG: Record<
  AssetFundingState,
  { label: string; icon: LucideIcon; badgeClass: string; cardClass: string }
> = {
  deficit: {
    label: "Deficit",
    icon: AlertTriangle,
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    cardClass: "border-red-200",
  },
  reserved: {
    label: "Reserved",
    icon: Scale,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    cardClass: "border-gray-200",
  },
  balanced: {
    label: "Balanced",
    icon: CheckCircle2,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    cardClass: "border-gray-200",
  },
  surplus: {
    label: "Surplus",
    icon: PiggyBank,
    badgeClass: "bg-green-50 text-green-700 border-green-200",
    cardClass: "border-gray-200",
  },
};

function FundingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium tabular-nums text-gray-900" data-testid="funding-metric">
        {value}
      </span>
    </div>
  );
}

function FundingInstructions({ assetCode, deficit }: { assetCode: string; deficit: number }) {
  return (
    <div
      data-testid="funding-instructions"
      className="mt-3 rounded-md border border-red-100 bg-red-50/60 p-3 space-y-1.5"
    >
      <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">
        Funding instructions
      </p>
      <ol className="list-decimal list-inside space-y-1 text-xs text-red-700">
        <li>
          Top up the treasury with at least{" "}
          <strong>{formatAssetAmount(deficit, assetCode)}</strong> of {assetCode}.
        </li>
        <li>Send funds only from a trusted exchange or custody wallet to the treasury address.</li>
        <li>
          Re-run this dashboard to confirm every asset shows balanced or surplus before
          executing payroll.
        </li>
      </ol>
      <Link
        href="/payroll/multi-asset"
        className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
      >
        Open multi-asset payroll planner
      </Link>
    </div>
  );
}

function AssetFundingCard({ position }: { position: AssetFundingPosition }) {
  const [showInstructions, setShowInstructions] = useState(false);
  const config = STATE_CONFIG[position.state];
  const Icon = config.icon;

  return (
    <article
      data-testid={`asset-funding-card-${position.key}`}
      data-state={position.state}
      aria-label={`${position.label} funding is ${config.label}`}
      className={`rounded-lg border bg-white shadow-sm p-4 ${config.cardClass}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Landmark className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900 truncate">{position.label}</h3>
        </div>
        <span
          role="status"
          aria-label={`Readiness state: ${config.label}`}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.badgeClass}`}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {config.label}
        </span>
      </header>

      <dl className="mt-3 space-y-1.5">
        <FundingMetric label="Required" value={formatAssetAmount(position.required, position.label)} />
        <FundingMetric label="Available" value={formatAssetAmount(position.available, position.label)} />
        {position.reserved > 0 && (
          <FundingMetric label="Reserved" value={formatAssetAmount(position.reserved, position.label)} />
        )}
        {position.surplus > 0 && (
          <FundingMetric label="Surplus" value={formatAssetAmount(position.surplus, position.label)} />
        )}
        {position.deficit > 0 && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-red-600 font-medium">Deficit</span>
            <span
              data-testid="funding-deficit-value"
              className="font-semibold tabular-nums text-red-600"
            >
              −{formatAssetAmount(position.deficit, position.label)}
            </span>
          </div>
        )}
      </dl>

      {position.isBlocking ? (
        <>
          <p
            role="alert"
            className="mt-3 flex items-start gap-1.5 text-xs font-medium text-red-600"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Blocks payroll execution until funded.
          </p>
          <button
            type="button"
            onClick={() => setShowInstructions((v) => !v)}
            aria-expanded={showInstructions}
            data-testid="toggle-funding-instructions"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            {showInstructions ? (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
            {showInstructions ? "Hide funding instructions" : "Show funding instructions"}
          </button>
          {showInstructions && (
            <FundingInstructions assetCode={position.label} deficit={position.deficit} />
          )}
        </>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-green-700">
          <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
          Covered for this run.
        </p>
      )}
    </article>
  );
}

export interface FundingImbalanceDashboardProps {
  /** Payroll groups to evaluate; defaults to all non-executed mock runs. */
  groups?: typeof MOCK_MULTI_ASSET_RUNS[number]["assetGroups"];
}

/**
 * Multi-asset funding imbalance dashboard. Shows per-asset required /
 * available / reserved / surplus / deficit states and highlights any asset
 * that would block payroll execution — deficits are never hidden by surplus
 * elsewhere in the treasury.
 */
export function FundingImbalanceDashboard({
  groups = MOCK_MULTI_ASSET_RUNS.filter((r) => r.status === "underfunded").flatMap(
    (r) => r.assetGroups,
  ),
}: FundingImbalanceDashboardProps) {
  const summary = useMemo(() => computeFundingPositions(groups), [groups]);

  if (summary.positions.length === 0) {
    return (
      <section
        aria-labelledby="funding-imbalance-heading"
        data-testid="funding-imbalance-dashboard"
        className="bg-white rounded-lg shadow-sm p-6"
      >
        <h2 id="funding-imbalance-heading" className="text-base font-semibold text-gray-900">
          Per-asset funding readiness
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          No draft multi-asset payroll runs to evaluate yet.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="funding-imbalance-heading"
      data-testid="funding-imbalance-dashboard"
      className="bg-white rounded-lg shadow-sm overflow-hidden"
    >
      <header className="px-4 sm:px-6 py-4 border-b border-gray-100">
        <h2 id="funding-imbalance-heading" className="text-base font-semibold text-gray-900">
          Per-asset funding readiness
        </h2>
        <p
          role={summary.isPayrollBlocked ? "alert" : "status"}
          data-testid="funding-overall-status"
          className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${
            summary.isPayrollBlocked ? "text-red-700 font-medium" : "text-green-700 font-medium"
          }`}
        >
          {summary.isPayrollBlocked ? (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {summary.blockingAssets.length} asset
              {summary.blockingAssets.length !== 1 ? "s" : ""} block payroll execution
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              All payroll assets are funded
            </>
          )}
          <span className="text-xs font-normal text-gray-500">
            Total required {summary.totalRequired.toLocaleString()} · Total available{" "}
            {summary.totalAvailable.toLocaleString()}
          </span>
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4 sm:p-6">
        {summary.positions.map((position) => (
          <AssetFundingCard key={position.key} position={position} />
        ))}
      </div>
    </section>
  );
}

export default FundingImbalanceDashboard;
