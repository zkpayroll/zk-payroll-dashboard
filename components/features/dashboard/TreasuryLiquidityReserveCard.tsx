"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  useTreasuryLiquidityReserve,
  type UseTreasuryLiquidityReserveOptions,
} from "@/hooks/useTreasuryLiquidityReserve";
import { formatRelativeAge } from "@/hooks/useStaleDataRefresh";
import {
  formatReserveRatioPercent,
  formatTreasuryAmount,
} from "@/lib/treasury/liquidityReserve";
import {
  TREASURY_LIQUIDITY_RESERVE_STATUS_LABELS,
  type TreasuryLiquidityReserveEvaluatedResult,
  type TreasuryLiquidityReserveResult,
  type TreasuryLiquidityReserveStatus,
} from "@/types/treasury";

export interface TreasuryLiquidityReserveCardProps
  extends UseTreasuryLiquidityReserveOptions {
  className?: string;
}

const HEADING_ID = "treasury-liquidity-reserve-heading";

// Each status pairs its colour with a distinct icon and a text label so the
// state never depends on colour alone.
const STATUS_STYLES: Record<
  TreasuryLiquidityReserveStatus,
  { icon: LucideIcon; container: string; iconColor: string; badge: string; text: string }
> = {
  healthy: {
    icon: CheckCircle2,
    container: "border-green-200 bg-green-50",
    iconColor: "text-green-700",
    badge: "bg-green-100 text-green-800",
    text: "text-green-800",
  },
  low: {
    icon: AlertTriangle,
    container: "border-amber-200 bg-amber-50",
    iconColor: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    text: "text-amber-800",
  },
  critical: {
    icon: XCircle,
    container: "border-red-200 bg-red-50",
    iconColor: "text-red-700",
    badge: "bg-red-100 text-red-800",
    text: "text-red-800",
  },
};

function describeStatus(result: TreasuryLiquidityReserveEvaluatedResult): string {
  const { assetCode, targetReservePercent } = result;
  const ratio = formatReserveRatioPercent(result.reserveRatioBps);

  switch (result.status) {
    case "healthy":
      return `The treasury holds ${ratio} of the next payroll run, at or above the ${targetReservePercent}% target reserve.`;
    case "low":
      return `The next payroll run is covered, but the treasury holds ${ratio} of it, below the ${targetReservePercent}% target reserve. Add ${formatTreasuryAmount(result.amountBelowTarget)} ${assetCode} to reach the target.`;
    case "critical":
      return result.balance === "0"
        ? `The treasury has no available ${assetCode}, so the next payroll run cannot be paid. Fund the treasury before the run executes.`
        : `The treasury cannot cover the next payroll run. Fund the treasury before the run executes.`;
  }
}

function FreshnessNote({ result }: { result: TreasuryLiquidityReserveResult }) {
  if (result.freshness === "fresh") return null;

  const message =
    result.freshness === "stale" && result.lastUpdated
      ? `Balance last updated ${formatRelativeAge(new Date(result.lastUpdated))}. It may not reflect recent deposits or withdrawals.`
      : "The balance has no recorded update time, so it may be out of date.";

  return (
    <p
      className="mt-2 flex items-start gap-1.5 text-xs text-gray-700"
      data-testid="treasury-liquidity-reserve-freshness"
      data-freshness={result.freshness}
    >
      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

function RefreshButton({
  label,
  isRefreshing,
  onClick,
}: {
  label: string;
  isRefreshing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRefreshing}
      className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-gray-900 underline hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {isRefreshing ? "Refreshing…" : label}
    </button>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{children}</dd>
    </div>
  );
}

/**
 * Dashboard monitor showing whether the treasury can fund the next payroll
 * run and how it compares with the target reserve (#630).
 */
export default function TreasuryLiquidityReserveCard({
  className = "",
  ...options
}: TreasuryLiquidityReserveCardProps) {
  const { isLoading, isRefreshing, error, result, refresh } =
    useTreasuryLiquidityReserve(options);

  const frame = (
    state: string,
    role: "status" | "alert",
    container: string,
    icon: ReactNode,
    badge: ReactNode,
    body: ReactNode,
  ) => (
    <section
      role={role}
      aria-labelledby={HEADING_ID}
      aria-busy={isLoading || isRefreshing}
      className={`rounded-lg border p-4 transition-all ${container} ${className}`}
      data-testid="treasury-liquidity-reserve"
      data-status={state}
    >
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 id={HEADING_ID} className="text-sm font-semibold text-gray-900">
              Treasury liquidity reserve
            </h3>
            {badge}
          </div>
          {body}
        </div>
      </div>
    </section>
  );

  if (isLoading) {
    return frame(
      "loading",
      "status",
      "border-gray-200 bg-white",
      <Loader2
        className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-gray-500"
        aria-hidden="true"
      />,
      null,
      <p className="mt-1 text-sm text-gray-600">Checking treasury liquidity reserve…</p>,
    );
  }

  if (error || !result || result.kind === "invalid") {
    const messages =
      result?.kind === "invalid"
        ? result.issues.map((issue) => issue.message)
        : [error ?? "Treasury reserve data is unavailable. Try again."];

    return frame(
      "error",
      "alert",
      "border-red-200 bg-red-50",
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />,
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
        Unavailable
      </span>,
      <>
        <p className="mt-1 text-sm font-medium text-red-800">
          Reserve status could not be determined.
        </p>
        <ul className="mt-1 space-y-1">
          {messages.map((message) => (
            <li key={message} className="text-sm text-red-800">
              {message}
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <RefreshButton label="Try again" isRefreshing={isRefreshing} onClick={refresh} />
        </div>
      </>,
    );
  }

  if (result.kind === "no_scheduled_payroll") {
    return frame(
      "empty",
      "status",
      "border-gray-200 bg-white",
      <CalendarOff className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />,
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
        No payroll scheduled
      </span>,
      <>
        <p className="mt-1 text-sm text-gray-700">
          There is no upcoming payroll run to measure the reserve against. Available
          balance: {formatTreasuryAmount(result.balance)} {result.assetCode}.
        </p>
        <FreshnessNote result={result} />
        <div className="mt-2">
          <Link
            href="/payroll/schedule"
            className="inline-flex rounded text-sm font-medium text-indigo-700 underline hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            View payroll schedule
          </Link>
        </div>
      </>,
    );
  }

  const styles = STATUS_STYLES[result.status];
  const StatusIcon = styles.icon;
  const needsFunding = result.status !== "healthy";

  return frame(
    result.status,
    result.status === "critical" ? "alert" : "status",
    styles.container,
    <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.iconColor}`} aria-hidden="true" />,
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}
    >
      {TREASURY_LIQUIDITY_RESERVE_STATUS_LABELS[result.status]}
    </span>,
    <>
      <p className={`mt-1 text-sm ${styles.text}`}>{describeStatus(result)}</p>

      {result.status === "critical" && (
        <p
          className="mt-1 text-sm font-semibold text-red-900"
          data-testid="treasury-liquidity-reserve-shortfall"
        >
          Shortfall: {formatTreasuryAmount(result.shortfall)} {result.assetCode}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Available balance">
          {formatTreasuryAmount(result.balance)} {result.assetCode}
        </Metric>
        <Metric label="Next payroll run">
          {formatTreasuryAmount(result.nextPayrollObligation)} {result.assetCode}
        </Metric>
        <Metric label="Reserve ratio">
          {formatReserveRatioPercent(result.reserveRatioBps)}
          <span className="font-normal text-gray-600">
            {" "}
            (target {result.targetReservePercent}%)
          </span>
        </Metric>
        <Metric label="Coverage">
          {result.runsCovered.toLocaleString("en-US")}{" "}
          {result.runsCovered === 1 ? "payroll run" : "payroll runs"}
        </Metric>
      </dl>

      <FreshnessNote result={result} />

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {needsFunding && (
          <Link
            href="/treasury"
            className="inline-flex rounded text-sm font-medium text-gray-900 underline hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            Fund treasury
          </Link>
        )}
        <RefreshButton label="Refresh" isRefreshing={isRefreshing} onClick={refresh} />
      </div>
    </>,
  );
}
