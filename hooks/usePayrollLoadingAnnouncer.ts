"use client";

import { useEffect, useRef } from "react";

export type PayrollLoadingPhase =
  | "idle"
  | "generating"
  | "submitting"
  | "success"
  | "error";

/**
 * Messages announced to screen readers via an aria-live region when a
 * payroll action transitions between phases.  Each string must be safe to
 * read aloud — it must never contain raw salary amounts or wallet keys.
 */
const PHASE_MESSAGES: Record<PayrollLoadingPhase, string> = {
  idle: "",
  generating: "Generating zero-knowledge proof. Please wait.",
  submitting: "Submitting payroll transaction. Please wait.",
  success: "Action completed successfully.",
  error: "Action failed. Review the error message below and try again.",
};

/**
 * Returns a `ref` that should be attached to a visually-hidden `<div>` with
 * `aria-live="assertive"` and `aria-atomic="true"`.  The hook injects the
 * appropriate announcement message whenever `phase` changes.
 *
 * The announcement is cleared 4 s after a terminal state (success / error)
 * to avoid stale reads on subsequent actions.
 */
export function usePayrollLoadingAnnouncer(phase: PayrollLoadingPhase) {
  const regionRef = useRef<HTMLDivElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = regionRef.current;
    if (!el) return;

    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    const message = PHASE_MESSAGES[phase];
    el.textContent = message;

    if (phase === "success" || phase === "error") {
      clearTimerRef.current = setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = "";
        }
      }, 4000);
    }

    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [phase]);

  return regionRef;
}
