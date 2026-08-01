"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface SessionInfo {
  publicKey: string;
  role: "admin" | "operator" | "auditor";
  expiresAt: number;
}

export type SessionState = "loading" | "active" | "expiring" | "expired";

const WARNING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes before expiry
const POLL_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

/**
 * Hook that fetches the current session info from the API and tracks
 * whether the session is still active, nearing expiry, or already expired.
 *
 * - "active":   session is valid with > 10 minutes remaining
 * - "expiring": session is valid but will expire within 10 minutes
 * - "expired":  session has expired or no session exists
 * - "loading":  initial fetch in progress
 */
export function useSession() {
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        setSessionState("expired");
        setSessionInfo(null);
        setTimeRemaining(null);
        return;
      }

      const data: SessionInfo = await res.json();
      const remaining = data.expiresAt - Date.now();

      setSessionInfo(data);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        setSessionState("expired");
      } else if (remaining <= WARNING_THRESHOLD_MS) {
        setSessionState("expiring");
      } else {
        setSessionState("active");
      }
    } catch {
      setSessionState("expired");
      setSessionInfo(null);
      setTimeRemaining(null);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Poll periodically to detect expiry
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(() => {
      fetchSession();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchSession]);

  // Update time remaining every 30 seconds
  useEffect(() => {
    if (sessionState === "expired" || sessionState === "loading") return;

    const tick = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) return 0;
        const next = prev - 30000;
        if (next <= 0) {
          setSessionState("expired");
          return 0;
        }
        if (next <= WARNING_THRESHOLD_MS && sessionState === "active") {
          setSessionState("expiring");
        }
        return next;
      });
    }, 30000);

    return () => clearInterval(tick);
  }, [sessionState]);

  const formatTimeRemaining = useCallback(() => {
    if (timeRemaining === null || timeRemaining <= 0) return "Expired";

    const totalMinutes = Math.floor(timeRemaining / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }, [timeRemaining]);

  return {
    sessionState,
    sessionInfo,
    timeRemaining,
    formatTimeRemaining,
    refresh: fetchSession,
  };
}
