"use client";

import React from "react";
import { RefreshCw, XCircle, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { useCancellableDataRefresh } from "@/hooks/useCancellableDataRefresh";

export interface CancellableRefreshButtonProps {
  initialLastFetchedAt?: string | number | Date | null;
  onRefresh?: (signal: AbortSignal) => Promise<void> | void;
  label?: string;
  className?: string;
}

export function CancellableRefreshButton({
  initialLastFetchedAt = null,
  onRefresh,
  label = "Data",
  className = "",
}: CancellableRefreshButtonProps) {
  const {
    lastFetchedAt,
    isStale,
    isRefreshing,
    isCancelled,
    error,
    statusMessage,
    refresh,
    cancelRefresh,
    relativeAge,
  } = useCancellableDataRefresh({
    initialLastFetchedAt,
    onRefresh,
  });

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-3">
        {isRefreshing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              aria-label={`Refreshing ${label}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 border border-indigo-200 cursor-wait"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
              <span>Refreshing...</span>
            </button>

            <button
              type="button"
              onClick={cancelRefresh}
              aria-label="Cancel refresh"
              data-testid="cancel-refresh-button"
              className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5 text-red-600" />
              <span>Cancel</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={refresh}
            aria-label={`Refresh ${label}`}
            data-testid="trigger-refresh-button"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
            <span>Refresh {label}</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span>Last updated: {relativeAge}</span>
          {isStale && (
            <span className="ml-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
              Stale
            </span>
          )}
        </div>
      </div>

      {/* Actionable Feedback Messages */}
      {statusMessage && (
        <div
          role="status"
          data-testid="refresh-status-message"
          className={`flex items-center gap-1.5 text-xs ${
            isCancelled
              ? "text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-md"
              : "text-green-700"
          }`}
        >
          {isCancelled ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          data-testid="refresh-error-message"
          className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 p-2 rounded-md"
        >
          <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default CancellableRefreshButton;
