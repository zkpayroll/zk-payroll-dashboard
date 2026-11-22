"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Shield,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import {
  evaluateTreasuryReservationGuidance,
  normalizeAssetCode,
  parseReservationAmountUnits,
  type ReservationGuidanceTone,
  type TreasuryReservationGuidance,
} from "@/lib/treasury/reservationGuidance";
import { useReservationsStore, type FundingReservation } from "@/stores/reservations";
import { useTreasuryStore } from "@/stores/treasury";

export interface TreasuryReservationGuidanceCardProps {
  guidance?: TreasuryReservationGuidance;
  reservations?: FundingReservation[];
  availableBalance?: number | string | null;
  projectedPayroll?: number | string | null;
  newReservationAmount?: number | string | null;
  assetCode?: string;
  hasConfiguredAssets?: boolean;
  now?: number;
  className?: string;
}

interface ToneVisualStyle {
  container: string;
  badge: string;
  iconColor: string;
  icon: LucideIcon;
}

const TONE_STYLES: Record<ReservationGuidanceTone, ToneVisualStyle> = {
  ready: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-950",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
    iconColor: "text-emerald-600",
    icon: CheckCircle2,
  },
  info: {
    container: "border-blue-200 bg-blue-50 text-blue-950",
    badge: "border-blue-200 bg-blue-100 text-blue-800",
    iconColor: "text-blue-600",
    icon: Info,
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-950",
    badge: "border-amber-200 bg-amber-100 text-amber-800",
    iconColor: "text-amber-600",
    icon: Clock,
  },
  blocked: {
    container: "border-red-200 bg-red-50 text-red-950",
    badge: "border-red-200 bg-red-100 text-red-800",
    iconColor: "text-red-600",
    icon: ShieldAlert,
  },
};

export function TreasuryReservationGuidanceCard({
  guidance: guidanceOverride,
  reservations: reservationsOverride,
  availableBalance: availableBalanceOverride,
  projectedPayroll: projectedPayrollOverride,
  newReservationAmount: newReservationAmountOverride,
  assetCode = "USDC",
  hasConfiguredAssets = true,
  now: nowOverride,
  className = "",
}: TreasuryReservationGuidanceCardProps) {
  const headingId = useId();
  const normalizedAsset = normalizeAssetCode(assetCode);

  const storeReservations = useReservationsStore((s) => s.reservations);
  const storeBalanceEntry = useTreasuryStore((s) => {
    if (Object.prototype.hasOwnProperty.call(s.balances, normalizedAsset)) {
      return s.balances[normalizedAsset];
    }
    return normalizedAsset === "USDC" ? s.balances.USDC : undefined;
  });

  const activeItems = reservationsOverride ?? storeReservations;
  const shouldTick =
    guidanceOverride === undefined &&
    nowOverride === undefined &&
    activeItems.length > 0;

  const [tickNow, setTickNow] = useState<number>(() => nowOverride ?? Date.now());

  useEffect(() => {
    if (!shouldTick) {
      return;
    }
    setTickNow(Date.now());
    const interval = setInterval(() => {
      setTickNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [shouldTick]);

  const effectiveNow = nowOverride ?? tickNow;
  const resolvedAvailable =
    availableBalanceOverride !== undefined
      ? availableBalanceOverride
      : (storeBalanceEntry?.available ?? 0);
  const resolvedProjected =
    projectedPayrollOverride !== undefined
      ? projectedPayrollOverride
      : (storeBalanceEntry?.projected ?? 0);

  const safeNewReservationAmount = useMemo(() => {
    if (
      newReservationAmountOverride === undefined ||
      newReservationAmountOverride === null ||
      newReservationAmountOverride === ""
    ) {
      return undefined;
    }
    const parsed = parseReservationAmountUnits(newReservationAmountOverride);
    return parsed.ok && parsed.units > BigInt(0)
      ? newReservationAmountOverride
      : undefined;
  }, [newReservationAmountOverride]);

  const resolvedGuidance = useMemo<TreasuryReservationGuidance>(() => {
    if (guidanceOverride) {
      return guidanceOverride;
    }
    return evaluateTreasuryReservationGuidance({
      reservations: activeItems,
      availableBalance: resolvedAvailable,
      projectedPayroll: resolvedProjected,
      newReservationAmount: safeNewReservationAmount,
      assetCode: normalizedAsset,
      hasConfiguredAssets,
      now: effectiveNow,
    });
  }, [
    guidanceOverride,
    activeItems,
    resolvedAvailable,
    resolvedProjected,
    safeNewReservationAmount,
    normalizedAsset,
    hasConfiguredAssets,
    effectiveNow,
  ]);

  const visual = TONE_STYLES[resolvedGuidance.tone] ?? TONE_STYLES.info;
  const ToneIcon =
    resolvedGuidance.reasonCode === "INVALID_TREASURY_DATA"
      ? AlertTriangle
      : visual.icon;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="treasury-reservation-guidance-card"
      data-tone={resolvedGuidance.tone}
      data-reason={resolvedGuidance.reasonCode}
      className={`rounded-lg border p-4 space-y-3 ${visual.container} ${className}`}
    >
      <div
        role={resolvedGuidance.tone === "blocked" ? "alert" : "status"}
        className="flex items-start justify-between gap-3 flex-wrap"
      >
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <ToneIcon
            className={`w-5 h-5 shrink-0 mt-0.5 ${visual.iconColor}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 id={headingId} className="text-sm font-semibold">
                Treasury reservation guidance
              </h3>
              <span
                data-testid="reservation-guidance-badge"
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${visual.badge}`}
              >
                {resolvedGuidance.badgeLabel}
              </span>
              <span className="font-mono text-xs opacity-75">
                {resolvedGuidance.reasonCode}
              </span>
            </div>
            <p className="text-sm font-medium mt-1">{resolvedGuidance.title}</p>
            <p className="text-xs opacity-90 mt-0.5">{resolvedGuidance.summary}</p>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 rounded-md bg-white/70 border border-current/10 p-3 text-xs">
        <div>
          <dt className="text-[11px] opacity-75">Total locks</dt>
          <dd className="font-semibold">{resolvedGuidance.counts.total}</dd>
        </div>
        <div>
          <dt className="text-[11px] opacity-75">Ready locks</dt>
          <dd className="font-semibold">{resolvedGuidance.counts.healthy}</dd>
        </div>
        <div>
          <dt className="text-[11px] opacity-75">Near-expiry locks</dt>
          <dd className="font-semibold">{resolvedGuidance.counts.warning}</dd>
        </div>
        <div>
          <dt className="text-[11px] opacity-75">Expired locks</dt>
          <dd className="font-semibold">{resolvedGuidance.counts.expired}</dd>
        </div>
        <div>
          <dt className="text-[11px] opacity-75">Active reserved</dt>
          <dd className="font-semibold" data-testid="guidance-active-reserved">
            {resolvedGuidance.formattedActiveReserved}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] opacity-75">Unreserved balance</dt>
          <dd className="font-semibold" data-testid="guidance-unreserved-balance">
            {resolvedGuidance.formattedUnreservedBalance}
          </dd>
        </div>
      </dl>

      <div className="rounded-md bg-white/75 border border-current/10 p-3 space-y-2.5 text-xs">
        <div>
          <h4 className="font-semibold uppercase tracking-wider text-[11px] opacity-80">
            Operator Guidance
          </h4>
          <p
            data-testid="treasury-reservation-guidance-text"
            className="mt-0.5 font-medium leading-relaxed"
          >
            {resolvedGuidance.guidance}
          </p>
        </div>

        {resolvedGuidance.nextSteps.length > 0 && (
          <div>
            <h4 className="font-semibold uppercase tracking-wider text-[11px] opacity-80">
              Recommended Next Steps
            </h4>
            <ol
              data-testid="treasury-reservation-next-steps"
              className="mt-1 list-decimal pl-4 space-y-0.5"
            >
              {resolvedGuidance.nextSteps.map((step, idx) => (
                <li key={`${idx}-${step}`} className="leading-normal">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div>
          <h4 className="font-semibold uppercase tracking-wider text-[11px] opacity-80">
            Reservation Controls Reference
          </h4>
          <dl
            data-testid="treasury-reservation-action-guides"
            className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            {resolvedGuidance.actionGuides.map((guide) => (
              <div
                key={guide.action}
                className="rounded border border-current/10 bg-white/80 p-2"
              >
                <dt className="font-semibold">{guide.label}</dt>
                <dd className="mt-0.5 opacity-85">{guide.effect}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-current/10 flex-wrap">
          {resolvedGuidance.remediationHref ? (
            <Link
              href={resolvedGuidance.remediationHref}
              data-testid="treasury-reservation-remediation-link"
              className="inline-flex items-center gap-1 font-semibold underline hover:opacity-80 text-xs"
            >
              {resolvedGuidance.remediationLabel ?? "Open Recommended Workflow"}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <span className="text-[11px] opacity-80">
              Settlement gate:{" "}
              {resolvedGuidance.canExecutePayroll ? "Permitted" : "Blocked"}
            </span>
          )}

          <span className="text-[11px] opacity-70 inline-flex items-center gap-1">
            <Shield className="w-3 h-3" aria-hidden="true" />
            Zero-Knowledge: Guidance evaluates aggregate treasury locks and public batch identifiers only
          </span>
        </div>
      </div>
    </section>
  );
}

export default TreasuryReservationGuidanceCard;
