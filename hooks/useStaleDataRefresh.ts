"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseStaleDataRefreshOptions {
  /** Timestamp when data was last retrieved (ISO string, epoch ms, or Date). */
  initialLastFetchedAt?: string | number | Date | null;
  /** Milliseconds after which data is considered stale. Default: 5 minutes (300,000 ms). */
  staleThresholdMs?: number;
  /** Optional async fetcher invoked on refresh. */
  onRefresh?: () => Promise<void> | void;
  /** Whether the component or data is actively enabled. Default: true. */
  enabled?: boolean;
}

export interface StaleDataRefreshState {
  /** When data was last fetched. */
  lastFetchedAt: Date | null;
  /** Whether the elapsed time exceeds the stale threshold. */
  isStale: boolean;
  /** Whether an active refresh operation is in flight. */
  isRefreshing: boolean;
  /** Human-readable failure message if the latest refresh failed. */
  error: string | null;
  /** Manually trigger a refresh. */
  refresh: () => Promise<boolean>;
  /** Mark the current data as explicitly stale (e.g., on remote event notification). */
  markStale: () => void;
  /** Reset freshness with a new timestamp. */
  markFresh: (timestamp?: Date | string | number) => void;
  /** Humanized relative age string (e.g. "Just now", "4m ago", "1h ago"). */
  relativeAge: string;
}

export function formatRelativeAge(lastFetched: Date | null, now: Date = new Date()): string {
  if (!lastFetched || isNaN(lastFetched.getTime())) {
    return "Unknown";
  }

  const diffMs = Math.max(0, now.getTime() - lastFetched.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffSec < 45) {
    return "Just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function useStaleDataRefresh({
  initialLastFetchedAt = null,
  staleThresholdMs = 5 * 60 * 1000,
  onRefresh,
  enabled = true,
}: UseStaleDataRefreshOptions = {}): StaleDataRefreshState {
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(() => {
    if (!initialLastFetchedAt) return null;
    const d = new Date(initialLastFetchedAt);
    return isNaN(d.getTime()) ? null : d;
  });

  const [manuallyStale, setManuallyStale] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [relativeAge, setRelativeAge] = useState<string>(() => formatRelativeAge(lastFetchedAt));

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Evaluate staleness based on threshold or manual flag
  const isStale = useCallback(() => {
    if (!enabled) return false;
    if (manuallyStale) return true;
    if (!lastFetchedAt) return true;
    return Date.now() - lastFetchedAt.getTime() >= staleThresholdMs;
  }, [enabled, manuallyStale, lastFetchedAt, staleThresholdMs]);

  // Periodic heartbeat to update relative age and check staleness
  useEffect(() => {
    if (!enabled) return;

    const updateAge = () => {
      setRelativeAge(formatRelativeAge(lastFetchedAt));
    };

    updateAge();
    const interval = setInterval(updateAge, 10000);
    return () => clearInterval(interval);
  }, [enabled, lastFetchedAt]);

  const markStale = useCallback(() => {
    setManuallyStale(true);
  }, []);

  const markFresh = useCallback((timestamp: Date | string | number = new Date()) => {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      setLastFetchedAt(d);
      setManuallyStale(false);
      setError(null);
      setRelativeAge(formatRelativeAge(d));
    }
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (isRefreshing) return false;

    setIsRefreshing(true);
    setError(null);

    try {
      if (onRefreshRef.current) {
        await onRefreshRef.current();
      }
      const now = new Date();
      setLastFetchedAt(now);
      setManuallyStale(false);
      setRelativeAge(formatRelativeAge(now));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to refresh data. Please try again.";
      setError(msg);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return {
    lastFetchedAt,
    isStale: isStale(),
    isRefreshing,
    error,
    refresh,
    markStale,
    markFresh,
    relativeAge,
  };
}
