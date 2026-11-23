"use client";

import React, { useState } from "react";
import { AlertTriangle, AlertCircle, Info, RefreshCw, Eye, X, Users, RotateCcw } from "lucide-react";
import type {
  ConcurrentEditEvaluationResult,
  ConcurrentEditWarning,
} from "@/src/payroll/concurrentPayrollEditWarning";
import { cn } from "@/lib/utils";

export interface ConcurrentPayrollEditWarningBannerProps {
  readonly evaluation: ConcurrentEditEvaluationResult;
  readonly onReloadLatest?: () => Promise<void> | void;
  readonly onReviewChanges?: () => void;
  readonly onRenewSession?: () => Promise<void> | void;
  readonly onDismiss?: () => void;
  readonly className?: string;
}

export function ConcurrentPayrollEditWarningBanner({
  evaluation,
  onReloadLatest,
  onReviewChanges,
  onRenewSession,
  onDismiss,
  className,
}: ConcurrentPayrollEditWarningBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);

  if (!evaluation.hasConflict || evaluation.warnings.length === 0 || isDismissed) {
    return null;
  }

  // Prioritize displaying the blocking warning or the highest severity warning
  const primaryWarning: ConcurrentEditWarning =
    evaluation.blockingWarning ?? evaluation.warnings[0];

  const isCritical = primaryWarning.severity === "critical";
  const isWarning = primaryWarning.severity === "warning";

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleReload = async () => {
    if (!onReloadLatest) return;
    try {
      setIsReloading(true);
      await onReloadLatest();
    } finally {
      setIsReloading(false);
    }
  };

  const handleRenew = async () => {
    if (!onRenewSession) return;
    try {
      setIsRenewing(true);
      await onRenewSession();
    } finally {
      setIsRenewing(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live={isCritical ? "assertive" : "polite"}
      data-testid="concurrent-payroll-edit-warning-banner"
      data-severity={primaryWarning.severity}
      data-conflict-type={primaryWarning.conflictType}
      className={cn(
        "relative rounded-xl border p-4 shadow-sm transition-all sm:flex sm:items-center sm:justify-between gap-4",
        isCritical
          ? "border-red-300 bg-red-50 text-red-900"
          : isWarning
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-blue-300 bg-blue-50 text-blue-900",
        className,
      )}
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <span
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg mt-0.5",
            isCritical
              ? "bg-red-200 text-red-800"
              : isWarning
              ? "bg-amber-200 text-amber-800"
              : "bg-blue-200 text-blue-800",
          )}
        >
          {isCritical ? (
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          ) : isWarning ? (
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Info className="h-5 w-5" aria-hidden="true" />
          )}
        </span>

        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold tracking-tight">
              {primaryWarning.title}
            </h3>
            <span
              data-testid="conflict-code-badge"
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-mono font-medium tracking-wide",
                isCritical
                  ? "bg-red-200/80 text-red-900"
                  : isWarning
                  ? "bg-amber-200/80 text-amber-900"
                  : "bg-blue-200/80 text-blue-900",
              )}
            >
              {primaryWarning.conflictType.toUpperCase()}
            </span>
            {evaluation.activeEditorCount > 1 && (
              <span
                data-testid="active-editors-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white/80 border border-gray-200 text-gray-700 shadow-2xs"
              >
                <Users className="h-3 w-3 text-gray-500" aria-hidden="true" />
                {evaluation.activeEditorCount} active
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm opacity-90 leading-relaxed">
            {primaryWarning.message}
          </p>

          <p className="text-[11px] text-gray-500 mt-1">
            Privacy-safe: Employee salary commitments and recipient identities are never exposed.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-0 shrink-0">
        {onReviewChanges && (
          <button
            type="button"
            onClick={onReviewChanges}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-800 shadow-2xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Review Changes
          </button>
        )}

        {primaryWarning.conflictType === "session_expired" && onRenewSession && (
          <button
            type="button"
            onClick={() => void handleRenew()}
            disabled={isRenewing}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-2xs hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          >
            <RotateCcw
              className={cn("h-3.5 w-3.5", isRenewing && "animate-spin")}
              aria-hidden="true"
            />
            {isRenewing ? "Renewing..." : "Renew Session"}
          </button>
        )}

        {onReloadLatest && (
          <button
            type="button"
            onClick={() => void handleReload()}
            disabled={isReloading}
            className={cn(
              "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-2xs focus:outline-none focus:ring-2 disabled:opacity-50",
              isCritical
                ? "bg-red-700 hover:bg-red-800 focus:ring-red-500"
                : "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
            )}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isReloading && "animate-spin")}
              aria-hidden="true"
            />
            {isReloading ? "Reloading..." : "Reload Latest"}
          </button>
        )}

        {/* Dismiss button only if not blocking */}
        {!primaryWarning.blocking && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss warning"
            className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-gray-500 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ConcurrentPayrollEditWarningBanner;
