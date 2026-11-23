"use client";

import React, { useState } from "react";
import { AlertTriangle, RefreshCw, Eye, X } from "lucide-react";
import type { PayrollConflictWarningState } from "@/hooks/usePayrollConflictWarning";
import { cn } from "@/lib/utils";
import { PayrollConflictWarningModal } from "./PayrollConflictWarningModal";

export interface PayrollConflictBannerProps {
  state: PayrollConflictWarningState;
  className?: string;
  onOpenDiffModal?: () => void;
  showModalOnReview?: boolean;
}

export function PayrollConflictBanner({
  state,
  className,
  onOpenDiffModal,
  showModalOnReview = true,
}: PayrollConflictBannerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const {
    hasConflict,
    conflictDetails,
    isResolving,
    error,
    resolveWithRemote,
    dismissConflict,
  } = state;

  if (!hasConflict || !conflictDetails) {
    return null;
  }

  const handleReviewClick = () => {
    if (onOpenDiffModal) {
      onOpenDiffModal();
    } else if (showModalOnReview) {
      setModalOpen(true);
    }
  };

  return (
    <>
      <div
        role="alert"
        aria-live="assertive"
        data-testid="payroll-conflict-banner"
        className={cn(
          "relative flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-amber-950">
              Concurrent modification detected
            </h3>
            <p className="text-xs text-amber-800 sm:text-sm">
              {conflictDetails.changeDescription}
            </p>
            {error && (
              <p
                role="alert"
                className="mt-1 text-xs font-medium text-red-700"
              >
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
          <button
            type="button"
            onClick={handleReviewClick}
            className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-amber-900 shadow-xs hover:bg-amber-100/60 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Review changes
          </button>

          <button
            type="button"
            onClick={() => void resolveWithRemote()}
            disabled={isResolving}
            className="inline-flex min-h-[44px] sm:min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isResolving && "animate-spin")}
              aria-hidden="true"
            />
            {isResolving ? "Reloading..." : "Reload latest"}
          </button>

          <button
            type="button"
            onClick={dismissConflict}
            aria-label="Dismiss warning"
            className="inline-flex min-h-[44px] sm:min-h-[36px] min-w-[44px] sm:min-w-[36px] items-center justify-center rounded-lg text-amber-700 hover:bg-amber-200/50 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {modalOpen && (
        <PayrollConflictWarningModal
          state={state}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
