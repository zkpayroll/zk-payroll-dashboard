"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatRelativeAge } from "@/hooks/useStaleDataRefresh";

export interface UseCancellableDataRefreshOptions {
  /** Timestamp when data was last retrieved. */
  initialLastFetchedAt?: string | number | Date | null;
  /** Milliseconds after which data is considered stale (default: 5 min). */
  staleThresholdMs?: number;
  /** Async fetcher receiving an AbortSignal for cancellation. */
  onRefresh?: (signal: AbortSignal) => Promise<void> | void;
  /** Whether the refresh functionality is enabled. */
  enabled?: boolean;
}

export interface CancellableDataRefreshState {
  lastFetchedAt: Date | null;
  isStale: boolean;
  isRefreshing: boolean;
  isCancelled: boolean;
  error: string | null;
  statusMessage: string | null;
  refresh: () => Promise<boolean>;
  cancelRefresh: () => void;
  markFresh: (timestamp?: Date | string | number) => void;
  relativeAge: string;
}

export function useCancellableDataRefresh({
  initialLastFetchedAt = null,
  staleThresholdMs = 5 * 60 * 1000,
  onRefresh,
  enabled = true,
}: UseCancellableDataRefreshOptions = {}): CancellableDataRefreshState {
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(() => {
    if (!initialLastFetchedAt) return null;
    const d = new Date(initialLastFetchedAt);
    return isNaN(d.getTime()) ? null : d;
  });

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [relativeAge, setRelativeAge] = useState<string>(() => formatRelativeAge(lastFetchedAt));

  const abortControllerRef = useRef<AbortController | null>(null);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const isStale = useCallback(() => {
    if (!enabled) return false;
    if (!lastFetchedAt) return true;
    return Date.now() - lastFetchedAt.getTime() >= staleThresholdMs;
  }, [enabled, lastFetchedAt, staleThresholdMs]);

  useEffect(() => {
    if (!enabled) return;
    const updateAge = () => setRelativeAge(formatRelativeAge(lastFetchedAt));
    updateAge();
    const interval = setInterval(updateAge, 10000);
    return () => clearInterval(interval);
  }, [enabled, lastFetchedAt]);

  const cancelRefresh = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRefreshing(false);
    setIsCancelled(true);
    setError(null);
    setStatusMessage("Data refresh was cancelled by user.");
  }, []);

  const markFresh = useCallback((timestamp: Date | string | number = new Date()) => {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      setLastFetchedAt(d);
      setError(null);
      setIsCancelled(false);
      setStatusMessage(null);
      setRelativeAge(formatRelativeAge(d));
    }
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (isRefreshing) return false;

    // Create new AbortController for this refresh request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsRefreshing(true);
    setIsCancelled(false);
    setError(null);
    setStatusMessage("Refreshing data...");

    try {
      if (onRefreshRef.current) {
        await onRefreshRef.current(controller.signal);
      }

      if (controller.signal.aborted) {
        setIsCancelled(true);
        setStatusMessage("Data refresh was cancelled by user.");
        return false;
      }

      const now = new Date();
      setLastFetchedAt(now);
      setIsCancelled(false);
      setStatusMessage("Data refreshed successfully.");
      setRelativeAge(formatRelativeAge(now));
      return true;
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
        setIsCancelled(true);
        setStatusMessage("Data refresh was cancelled by user.");
        return false;
      }

      const rawMsg = err instanceof Error ? err.message : "Failed to refresh data.";
      // Ensure zero exposure of financial numbers in error messages
      const safeErrorMsg = rawMsg.match(/\$|\b[0-9]{4,}\b/)
        ? "Refresh failed. Please try again."
        : rawMsg;

      setError(safeErrorMsg);
      setStatusMessage(null);
      return false;
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return {
    lastFetchedAt,
    isStale: isStale(),
    isRefreshing,
    isCancelled,
    error,
    statusMessage,
    refresh,
    cancelRefresh,
    markFresh,
    relativeAge,
  };
}
