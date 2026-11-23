"use client";

/**
 * #471 – useSessionTimeoutWarning
 *
 * Builds on top of useSession to provide a configurable dashboard-level
 * session-expiry warning.  When the session transitions into "expiring"
 * state the hook fires, giving the operator a chance to extend their
 * session before sensitive payroll work is interrupted.
 *
 * Configuration
 * ─────────────
 * • warningThresholdMs  — how many ms before expiry to start showing the
 *   warning (default 10 min, matches the useSession WARNING_THRESHOLD_MS).
 * • urgentThresholdMs   — secondary threshold at which the UI escalates to
 *   an "urgent" variant (default 2 min).
 * • onExtend            — async callback the component calls when the user
 *   clicks "Extend session". Responsible for hitting the refresh endpoint.
 * • onExpired           — called once when state transitions to "expired".
 *   Use it to redirect to /login or flush unsaved state.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useSession } from "@/hooks/useSession";

export type TimeoutWarningLevel = "idle" | "warning" | "urgent" | "expired";

export interface UseSessionTimeoutWarningOptions {
  /** Warn when this many ms remain. Default: 10 minutes. */
  warningThresholdMs?: number;
  /** Escalate to "urgent" when this many ms remain. Default: 2 minutes. */
  urgentThresholdMs?: number;
  /** Called when the user requests a session extension. */
  onExtend?: () => Promise<void>;
  /** Called once when the session actually expires. */
  onExpired?: () => void;
}

export interface UseSessionTimeoutWarningResult {
  /** Current warning level — drives which UI variant to render. */
  level: TimeoutWarningLevel;
  /** Human-readable countdown string ("8m remaining", "Expired", …). */
  formattedTimeRemaining: string;
  /** Raw ms remaining (null while loading). */
  timeRemaining: number | null;
  /** Whether an extension request is in-flight. */
  isExtending: boolean;
  /** Trigger a session extension; no-op if no onExtend provided. */
  extend: () => Promise<void>;
  /** Dismiss the warning banner without extending (user acknowledged). */
  dismiss: () => void;
  /** Whether the warning has been dismissed for this session state. */
  dismissed: boolean;
}

const DEFAULT_WARNING_THRESHOLD_MS = 10 * 60 * 1000; // 10 min
const DEFAULT_URGENT_THRESHOLD_MS = 2 * 60 * 1000;   //  2 min

export function useSessionTimeoutWarning(
  options: UseSessionTimeoutWarningOptions = {},
): UseSessionTimeoutWarningResult {
  const {
    warningThresholdMs = DEFAULT_WARNING_THRESHOLD_MS,
    urgentThresholdMs = DEFAULT_URGENT_THRESHOLD_MS,
    onExtend,
    onExpired,
  } = options;

  const { sessionState, timeRemaining, formatTimeRemaining, refresh } =
    useSession();

  const [isExtending, setIsExtending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Re-surface the warning when the level changes so a new "urgency" bump
  // un-dismisses a previously dismissed softer warning.
  const prevLevelRef = useRef<TimeoutWarningLevel>("idle");

  // ── Derived level ──────────────────────────────────────────────────────────
  const level: TimeoutWarningLevel = (() => {
    if (sessionState === "loading") return "idle";
    if (sessionState === "expired") return "expired";
    if (timeRemaining === null) return "idle";
    if (timeRemaining <= urgentThresholdMs) return "urgent";
    if (timeRemaining <= warningThresholdMs) return "warning";
    return "idle";
  })();

  // Un-dismiss when level escalates (e.g. warning → urgent).
  useEffect(() => {
    if (level !== prevLevelRef.current) {
      if (
        (prevLevelRef.current === "warning" && level === "urgent") ||
        (prevLevelRef.current === "idle" && level === "warning")
      ) {
        setDismissed(false);
      }
      prevLevelRef.current = level;
    }
  }, [level]);

  // ── Expired callback ───────────────────────────────────────────────────────
  const expiredFiredRef = useRef(false);
  useEffect(() => {
    if (level === "expired" && !expiredFiredRef.current) {
      expiredFiredRef.current = true;
      onExpired?.();
    }
    if (level !== "expired") {
      expiredFiredRef.current = false;
    }
  }, [level, onExpired]);

  // ── Extend ─────────────────────────────────────────────────────────────────
  const extend = useCallback(async () => {
    if (isExtending) return;
    setIsExtending(true);
    try {
      if (onExtend) {
        await onExtend();
      } else {
        // Default: re-fetch the session (forces token refresh on the server).
        await refresh();
      }
      setDismissed(true);
    } finally {
      setIsExtending(false);
    }
  }, [isExtending, onExtend, refresh]);

  const dismiss = useCallback(() => setDismissed(true), []);

  return {
    level,
    formattedTimeRemaining: formatTimeRemaining(),
    timeRemaining,
    isExtending,
    extend,
    dismiss,
    dismissed,
  };
}
