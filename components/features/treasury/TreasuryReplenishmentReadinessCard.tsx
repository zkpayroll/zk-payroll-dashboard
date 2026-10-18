"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { usePayrollPolicyStore } from "@/stores/payrollPolicy";
import { useTreasuryStore } from "@/stores/treasury";
import { formatTreasuryAmount } from "@/lib/treasury/liquidityReserve";
import { analyzeTreasuryReplenishmentReadiness } from "@/lib/treasury/replenishmentReadiness";
import {
  TREASURY_REPLENISHMENT_READINESS_STATUS_LABELS,
  type TreasuryReplenishmentReadinessResult,
  type TreasuryReplenishmentReadinessStatus,
  type TreasuryReplenishmentSnapshot,
} from "@/types/treasury";

export interface TreasuryReplenishmentReadinessCardProps {
  snapshot?: TreasuryReplenishmentSnapshot;
  className?: string;
}

const HEADING_ID = "treasury-replenishment-readiness-heading";

type StatusStyle = {
  icon: LucideIcon;
  container: string;
  iconColor: string;
  badge: string;
  text: string;
  role: "status" | "alert";
};

const STATUS_STYLES: Record<TreasuryReplenishmentReadinessStatus, StatusStyle> = {
  ready: {
    icon: CheckCircle2,
    container: "border-green-200 bg-green-50",
    iconColor: "text-green-700",
    badge: "bg-green-100 text-green-800",
    text: "text-green-800",
    role: "status",
  },
  watch: {
    icon: TrendingUp,
    container: "border-amber-200 bg-amber-50",
    iconColor: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    text: "text-amber-800",
    role: "status",
  },
  replenish_now: {
    icon: XCircle,
    container: "border-red-200 bg-red-50",
    iconColor: "text-red-700",
    badge: "bg-red-100 text-red-800",
    text: "text-red-800",
    role: "alert",
  },
};

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{children}</dd>
    </div>
  );
}

function useStoreSnapshot(): TreasuryReplenishmentSnapshot {
  const balance = useTreasuryStore((s) => s.balances);
  const obligations = useTreasuryStore((s) => s.obligations);
  const reserves = usePayrollPolicyStore((s) => s.policy.reserves);

  const assetEntry = balance.USDC ?? Object.values(balance)[0];
  const nextObligation = [...obligations].sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate),
  )[0];

  return {
    assetCode: assetEntry?.assetCode ?? "USDC",
    availableBalance: assetEntry?.available,
    nextPayrollObligation: nextObligation?.amount ?? assetEntry?.projected,
    policy: reserves,
  };
}

function Frame({
  state,
  role,
  container,
  icon,
  badge,
  children,
  className,
}: {
  state: string;
  role: "status" | "alert";
  container: string;
  icon: ReactNode;
  badge: ReactNode;
  children: ReactNode;
  className: string;
}) {
  return (
    <section
      role={role}
      aria-labelledby={HEADING_ID}
      data-testid="treasury-replenishment-readiness"
      data-status={state}
      className={`rounded-lg border p-4 transition-all ${container} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 id={HEADING_ID} className="text-sm font-semibold text-gray-900">
              Treasury replenishment readiness
            </h3>
            {badge}
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * Dashboard card showing whether the treasury should be replenished before
 * the next payroll run, driven by the configured reserve policy (#617).
 */
export default function TreasuryReplenishmentReadinessCard({
  snapshot,
  className = "",
}: TreasuryReplenishmentReadinessCardProps) {
  const storeSnapshot = useStoreSnapshot();
  const result: TreasuryReplenishmentReadinessResult =
    analyzeTreasuryReplenishmentReadiness(snapshot ?? storeSnapshot);

  if (result.kind === "invalid") {
    return (
      <Frame
        state="error"
        role="alert"
        container="border-red-200 bg-red-50"
        icon={<AlertTriangle className="h-5 w-5 text-red-700" aria-hidden="true" />}
        badge={
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            Unavailable
          </span>
        }
        className={className}
      >
        <p className="mt-1 text-sm font-medium text-red-800">
          Replenishment readiness could not be determined.
        </p>
        <ul className="mt-1 space-y-1">
          {result.issues.map((issue) => (
            <li key={issue.message} className="text-sm text-red-800">
              {issue.message}
            </li>
          ))}
        </ul>
        <div className="mt-2">
          <Link
            href="/settings/payroll-policy"
            className="inline-flex rounded text-sm font-medium text-gray-900 underline hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            Review reserve policy
          </Link>
        </div>
      </Frame>
    );
  }

  const styles = STATUS_STYLES[result.status];
  const StatusIcon = styles.icon;

  return (
    <Frame
      state={result.status}
      role={styles.role}
      container={styles.container}
      icon={<StatusIcon className={`h-5 w-5 ${styles.iconColor}`} aria-hidden="true" />}
      badge={
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}
        >
          {TREASURY_REPLENISHMENT_READINESS_STATUS_LABELS[result.status]}
        </span>
      }
      className={className}
    >
      <p className={`mt-1 text-sm ${styles.text}`} data-testid="treasury-replenishment-message">
        {result.message}
      </p>

      {result.status === "replenish_now" && result.shortfall !== "0" && (
        <p
          className="mt-1 text-sm font-semibold text-red-900"
          data-testid="treasury-replenishment-shortfall"
        >
          Shortfall: {formatTreasuryAmount(result.shortfall)} {result.assetCode}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Available balance">
          {formatTreasuryAmount(result.balance)} {result.assetCode}
        </Metric>
        <Metric label="Policy reserve target">
          {formatTreasuryAmount(result.targetReserveAmount)} {result.assetCode}
        </Metric>
        <Metric label="Replenish threshold">
          {formatTreasuryAmount(result.replenishThresholdAmount)} {result.assetCode}
        </Metric>
        <Metric label="Recommended top-up">
          {result.topUpAmount === "0" ? (
            "None"
          ) : (
            <>
              {formatTreasuryAmount(result.topUpAmount)} {result.assetCode}
            </>
          )}
        </Metric>
      </dl>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {result.shouldReplenish && (
          <Link
            href="/treasury"
            className="inline-flex rounded text-sm font-medium text-gray-900 underline hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            Replenish treasury
          </Link>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Evaluated from live treasury and payroll policy state
        </span>
      </div>
    </Frame>
  );
}
