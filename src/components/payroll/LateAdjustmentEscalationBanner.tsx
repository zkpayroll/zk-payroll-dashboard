"use client";

import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  evaluateLateAdjustmentEscalation,
  lateAdjustmentEscalationLabel,
  type LateAdjustmentWindowPolicy,
} from "@/lib/payroll/lateAdjustmentEscalation";

export interface LateAdjustmentEscalationBannerProps {
  /** ISO timestamp the payroll period/run closed. */
  periodClosedAt: string;
  /** ISO timestamp the adjustment was requested. */
  requestedAt: string;
  policy: LateAdjustmentWindowPolicy;
  className?: string;
}

/**
 * Surfaces whether a payroll adjustment was requested late and, if so, which
 * escalation tier (senior vs. executive review) it requires before a
 * standard approver can act on it (#683). Renders nothing when the request
 * was on-time — this is deliberately quiet for the common case.
 */
export function LateAdjustmentEscalationBanner({
  periodClosedAt,
  requestedAt,
  policy,
  className,
}: LateAdjustmentEscalationBannerProps) {
  const result = evaluateLateAdjustmentEscalation(periodClosedAt, requestedAt, policy);

  if (!result.isLate) {
    return null;
  }

  const isExecutive = result.escalationTier === "executive_review";

  return (
    <div
      role="alert"
      data-testid="late-adjustment-escalation-banner"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        isExecutive
          ? "border-red-300 bg-red-50 text-red-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
        className,
      )}
    >
      {isExecutive ? (
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      )}
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2">
          Late Adjustment —{" "}
          <span
            data-testid="late-adjustment-escalation-tier"
            className={cn(
              "px-2 py-0.5 text-xs font-mono rounded border",
              isExecutive
                ? "bg-red-100 text-red-800 border-red-200"
                : "bg-amber-100 text-amber-800 border-amber-200",
            )}
          >
            {lateAdjustmentEscalationLabel(result.escalationTier)}
          </span>
        </h4>
        <p className="text-sm mt-1">{result.reason}</p>
      </div>
    </div>
  );
}

export default LateAdjustmentEscalationBanner;
