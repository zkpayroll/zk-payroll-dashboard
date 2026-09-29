"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivePeriodConflictWarningProps {
  periodId: string;
  conflictingPeriodId: string;
  conflictReason: string;
  className?: string;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function ActivePeriodConflictWarning({
  periodId,
  conflictingPeriodId,
  conflictReason,
  className,
  onDismiss,
  actionLabel,
  onAction,
}: ActivePeriodConflictWarningProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="active-period-conflict-warning"
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-200 text-red-800">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-red-950">
            Active payroll period conflict
          </h3>
          <p className="text-xs text-red-800 sm:text-sm">
            {conflictReason}
          </p>
          <p className="text-xs text-red-700 mt-1">
            Period <code className="bg-red-100 px-1.5 py-0.5 rounded text-red-900 font-mono text-xs">{periodId}</code> conflicts with active period <code className="bg-red-100 px-1.5 py-0.5 rounded text-red-900 font-mono text-xs">{conflictingPeriodId}</code>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
          >
            {actionLabel}
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss warning"
          className="inline-flex min-h-[44px] sm:min-h-[36px] min-w-[44px] sm:min-w-[36px] items-center justify-center rounded-lg text-red-700 hover:bg-red-200/50 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default ActivePeriodConflictWarning;
