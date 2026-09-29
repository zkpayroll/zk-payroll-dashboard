"use client";

import { AlertCircle, RefreshCw, Clock } from "lucide-react";
import { type StaleDataRefreshState } from "@/hooks/useStaleDataRefresh";

export interface StaleDataIndicatorProps {
  /** Freshness state returned by useStaleDataRefresh hook, or manual props. */
  state: StaleDataRefreshState;
  /** Presentation variant: 'banner' for page/card top alert, 'compact' for toolbar pill. Default: 'banner'. */
  variant?: "banner" | "compact";
  /** Optional custom title or section name for the data being displayed. */
  resourceName?: string;
  /** Whether to hide completely when data is fresh. Default: false for compact, true for banner. */
  hideWhenFresh?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

export function StaleDataIndicator({
  state,
  variant = "banner",
  resourceName = "Payroll data",
  hideWhenFresh,
  className = "",
}: StaleDataIndicatorProps) {
  const { isStale, isRefreshing, error, refresh, relativeAge } = state;

  const shouldHide = (hideWhenFresh ?? (variant === "banner")) && !isStale && !error;
  if (shouldHide && !isRefreshing) {
    return null;
  }

  if (variant === "compact") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-2 text-xs text-gray-500 ${className}`}
        data-testid="stale-data-compact"
      >
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
          <span>Updated {relativeAge}</span>
          {isStale && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800"
              data-testid="stale-badge"
            >
              Stale
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={() => refresh()}
          disabled={isRefreshing}
          aria-label={isRefreshing ? "Refreshing data" : `Refresh ${resourceName}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          data-testid="stale-refresh-button"
        >
          <RefreshCw
            className={`w-3 h-3 ${isRefreshing ? "animate-spin text-indigo-600" : "text-gray-500"}`}
            aria-hidden="true"
          />
          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </button>

        {error && (
          <span
            role="alert"
            className="inline-flex items-center gap-1 text-red-600 font-medium text-xs ml-1"
            data-testid="stale-refresh-error"
          >
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            <span>{error}</span>
          </span>
        )}
      </div>
    );
  }

  // Default 'banner' variant
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border p-3 sm:p-4 transition-all ${
        error
          ? "border-red-200 bg-red-50 text-red-900"
          : isStale
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-gray-200 bg-gray-50 text-gray-800"
      } ${className}`}
      data-testid="stale-data-banner"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {error ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          )}

          <div>
            <p className="text-sm font-medium">
              {error
                ? "Failed to refresh payroll records"
                : isStale
                  ? `${resourceName} may be out of date`
                  : `${resourceName} is up to date`}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {error ? (
                <span data-testid="stale-error-message">{error}</span>
              ) : (
                <>
                  Last synced: <span className="font-medium text-gray-800">{relativeAge}</span>.
                  {isStale && " New on-chain transactions or reviewer approvals may be available."}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isRefreshing}
            aria-label={isRefreshing ? "Refreshing data" : `Refresh ${resourceName}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            data-testid="stale-banner-refresh-btn"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : "text-gray-500"}`}
              aria-hidden="true"
            />
            <span>{isRefreshing ? "Refreshing..." : "Refresh now"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default StaleDataIndicator;
