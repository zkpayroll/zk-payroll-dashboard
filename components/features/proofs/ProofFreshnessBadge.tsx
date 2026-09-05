"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileWarning, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  evaluateProofFreshness,
  formatProofCountdown,
  type ProofFreshnessState,
} from "@/lib/formatting/proofFreshness";

const STATE_CONFIG: Record<
  ProofFreshnessState,
  { icon: LucideIcon; badgeClass: string }
> = {
  fresh: {
    icon: CheckCircle2,
    badgeClass: "bg-green-50 text-green-700 border-green-200",
  },
  expiring: {
    icon: Clock,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
  },
  expired: {
    icon: AlertTriangle,
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  missing: {
    icon: FileWarning,
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

export interface ProofFreshnessBadgeProps {
  /** Proof metadata attached to the payroll run, if any. */
  reference?: { expiresAt: string; proofStatus: "verified" | "pending" | "failed" | "expired" } | null;
  /** Injected clock for deterministic rendering/tests. */
  now?: number;
  /** Route offering proof replacement; omitted hides the action link. */
  replacementHref?: string;
  /** Label for the replacement action. */
  replacementLabel?: string;
}

/**
 * Visual freshness indicator for a payroll proof. Fresh, expiring, expired,
 * and missing states each render with distinct styling and operator guidance.
 */
export function ProofFreshnessBadge({
  reference,
  now = Date.now(),
  replacementHref = "/payroll/execute",
  replacementLabel = "Replace proof",
}: ProofFreshnessBadgeProps) {
  const evaluation = evaluateProofFreshness({ reference }, now);
  const config = STATE_CONFIG[evaluation.state];
  const Icon = config.icon;

  return (
    <div
      data-testid={`proof-freshness-${evaluation.state}`}
      role="status"
      aria-label={`Proof status: ${evaluation.label}`}
      className={`inline-flex max-w-xs flex-col gap-1 rounded-lg border px-2.5 py-1.5 ${config.badgeClass}`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {evaluation.label}
        {evaluation.remainingMs !== null && evaluation.remainingMs > 0 && (
          <span className="font-normal tabular-nums">
            · {formatProofCountdown(evaluation.remainingMs)} left
          </span>
        )}
      </span>
      <span className="text-xs font-normal leading-snug">{evaluation.message}</span>
      {(evaluation.state === "expired" || evaluation.state === "expiring") &&
        replacementHref &&
        replacementLabel && (
          <Link
            href={replacementHref}
            data-testid="proof-replacement-link"
            className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:no-underline"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {replacementLabel}
          </Link>
        )}
    </div>
  );
}

export default ProofFreshnessBadge;
