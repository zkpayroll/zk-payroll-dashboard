"use client";

import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import {
  useComplianceHoldsStore,
  formatScopeLabel,
  formatReasonLabel,
  type ComplianceHold,
  type ComplianceHoldScope,
} from "@/stores/complianceHolds";

// ─── Scoped banner styles ───────────────────────────────────────────────────

const SCOPE_STYLES: Record<
  ComplianceHoldScope,
  { bg: string; border: string; text: string; iconColor: string }
> = {
  employer: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    iconColor: "text-red-600",
  },
  period: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    iconColor: "text-amber-600",
  },
  batch: {
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-800",
    iconColor: "text-orange-600",
  },
  employee: {
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-800",
    iconColor: "text-yellow-600",
  },
};

function HoldBannerRow({
  hold,
  onRelease,
  canRelease,
}: {
  hold: ComplianceHold;
  onRelease?: (holdId: string) => void;
  canRelease: boolean;
}) {
  const styles = SCOPE_STYLES[hold.scope];

  return (
    <div
      role="alert"
      data-testid={`compliance-hold-banner-${hold.scope}`}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${styles.bg} ${styles.border}`}
    >
      <ShieldAlert
        className={`mt-0.5 h-4 w-4 shrink-0 ${styles.iconColor}`}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${styles.text}`}>
          {formatReasonLabel(hold.reasonCode)}
        </p>
        <p className={`text-sm mt-0.5 ${styles.text} opacity-80`}>
          Scope: {formatScopeLabel(hold.scope)}
          {hold.targetLabel ? ` — ${hold.targetLabel}` : ""}
        </p>
        <p className="text-xs mt-1 opacity-70">
          Created: {new Date(hold.createdAt).toLocaleString()}
        </p>
        {hold.description && (
          <p className="text-xs mt-1 opacity-70">{hold.description}</p>
        )}
      </div>
      {canRelease && onRelease && (
        <button
          onClick={() => onRelease(hold.id)}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${styles.border} ${styles.text} hover:opacity-80`}
          aria-label={`Release ${hold.scope} compliance hold`}
        >
          Release
        </button>
      )}
    </div>
  );
}

// ─── ComplianceHoldBanner ───────────────────────────────────────────────────

export interface ComplianceHoldBannerProps {
  /** Optional filter to show only holds matching this scope */
  scope?: ComplianceHoldScope;
}

/**
 * Renders banners for all active compliance holds, optionally filtered by scope.
 * Each banner shows the safe hold information: reason code, scope, and created time.
 * Release buttons are shown only for authorized roles.
 */
export default function ComplianceHoldBanner({
  scope,
}: ComplianceHoldBannerProps) {
  const holds = useComplianceHoldsStore((s) => s.holds);
  const currentRole = useComplianceHoldsStore((s) => s.currentRole);
  const releaseHold = useComplianceHoldsStore((s) => s.releaseHold);

  const activeHolds = useMemo(() => {
    const filtered = holds.filter((h) => h.status === "active");
    if (scope) return filtered.filter((h) => h.scope === scope);
    return filtered;
  }, [holds, scope]);

  const canRelease = currentRole === "admin";

  if (activeHolds.length === 0) return null;

  const handleRelease = (holdId: string) => {
    releaseHold(holdId, "current_user");
  };

  return (
    <div className="space-y-2" data-testid="compliance-hold-banner-container">
      {activeHolds.map((hold) => (
        <HoldBannerRow
          key={hold.id}
          hold={hold}
          onRelease={handleRelease}
          canRelease={canRelease}
        />
      ))}
    </div>
  );
}

// ─── EmployerHoldBanner ─────────────────────────────────────────────────────

/**
 * Banner variant scoped specifically to employer-wide holds.
 */
export function EmployerHoldBanner() {
  return <ComplianceHoldBanner scope="employer" />;
}

// ─── PeriodHoldBanner ───────────────────────────────────────────────────────

/**
 * Banner variant scoped to payroll period holds.
 */
export function PeriodHoldBanner() {
  return <ComplianceHoldBanner scope="period" />;
}

// ─── BatchHoldBanner ────────────────────────────────────────────────────────

/**
 * Banner variant scoped to batch holds.
 */
export function BatchHoldBanner() {
  return <ComplianceHoldBanner scope="batch" />;
}

// ─── EmployeeHoldBanner ─────────────────────────────────────────────────────

/**
 * Banner variant scoped to individual employee holds.
 */
export function EmployeeHoldBanner() {
  return <ComplianceHoldBanner scope="employee" />;
}
