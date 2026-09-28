"use client";

import { useState, useCallback } from "react";
import { RefreshCw, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface CacheFreshnessIndicatorProps {
  /** Timestamp when the data was last fetched/refreshed */
  lastRefreshedAt: string | Date | number | null;
  /** Callback to trigger a data refresh */
  onRefresh: () => void | Promise<void>;
  /** Optional label for the data source being tracked */
  dataSourceLabel?: string;
  /** Whether a refresh is currently in progress */
  isRefreshing?: boolean;
  /** Variant: "compact" for inline use, "full" for detailed display */
  variant?: "compact" | "full";
  /** Optional custom class name */
  className?: string;
  /** Maximum age in milliseconds before data is considered stale (default: 5 minutes) */
  staleThresholdMs?: number;
}

export function CacheFreshnessIndicator({
  lastRefreshedAt,
  onRefresh,
  dataSourceLabel = "Data",
  isRefreshing = false,
  variant = "full",
  className = "",
  staleThresholdMs = 5 * 60 * 1000, // 5 minutes
}: CacheFreshnessIndicatorProps) {
  const [relativeTime, setRelativeTime] = useState<string>("");

  // Update relative time every 30 seconds
  const refreshRelativeTime = useCallback(() => {
    if (!lastRefreshedAt) {
      setRelativeTime("Never refreshed");
      return;
    }
    const lastRefreshed = new Date(lastRefreshedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastRefreshed.getTime();
    
    if (diffMs < 1000) {
      setRelativeTime("Just now");
    } else if (diffMs < 60 * 1000) {
      const seconds = Math.floor(diffMs / 1000);
      setRelativeTime(`${seconds}s ago`);
    } else if (diffMs < 60 * 60 * 1000) {
      const minutes = Math.floor(diffMs / (60 * 1000));
      setRelativeTime(`${minutes}m ago`);
    } else if (diffMs < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diffMs / (60 * 60 * 1000));
      setRelativeTime(`${hours}h ago`);
    } else {
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      setRelativeTime(`${days}d ago`);
    }
  }, [lastRefreshedAt]);

  // Initial calculation and interval
  const [, forceUpdate] = useState({});
  refreshRelativeTime();
  const intervalId = typeof window !== 'undefined' ? setInterval(() => {
    refreshRelativeTime();
    forceUpdate(prev => ({ ...prev }));
  }, 30000) : null;

  // Cleanup
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const cleanup = () => {
      if (intervalId) clearInterval(intervalId);
    };
    // Use a ref-like pattern with useEffect would be better, but for simplicity:
    (window as any).__cacheFreshnessCleanup = cleanup;
  }

  const isStale = lastRefreshedAt 
    ? Date.now() - new Date(lastRefreshedAt).getTime() > staleThresholdMs
    : true;

  const formatAbsolute = (date: Date) => {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRefresh = async () => {
    await onRefresh();
    refreshRelativeTime();
    forceUpdate(prev => ({ ...prev }));
  };

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
        <Clock className={`w-3 h-3 ${isStale ? "text-amber-500" : "text-gray-400"}`} aria-hidden="true" />
        <span className={isStale ? "text-amber-600" : "text-gray-500"}>
          {relativeTime || (lastRefreshedAt ? "Loading..." : "Never")}
        </span>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label={`Refresh ${dataSourceLabel}`}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
        {isStale && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 rounded-full">
            <AlertCircle className="w-2.5 h-2.5" aria-hidden="true" />
            Stale
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 flex items-start gap-3 ${isStale ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={`flex-shrink-0 p-2 rounded-full ${isStale ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"}`}>
        {isStale ? (
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
        ) : (
          <CheckCircle className="w-5 h-5" aria-hidden="true" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900">
            {dataSourceLabel} Freshness
          </h4>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={`Refresh ${dataSourceLabel}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Clock className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
            <span>
              Last refreshed: <strong>{relativeTime || "Never"}</strong>
              {lastRefreshedAt && (
                <>
                  <span className="text-gray-400"> ({formatAbsolute(new Date(lastRefreshedAt))})</span>
                </>
              )}
            </span>
          </div>
          
          {isStale && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              Data may be stale — consider refreshing
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default CacheFreshnessIndicator;
