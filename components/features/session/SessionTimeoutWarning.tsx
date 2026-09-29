"use client";

/**
 * #471 – SessionTimeoutWarning
 *
 * Renders a dismissible banner that escalates to a blocking modal as the
 * session nears expiry.
 *
 * • level === "warning"  → sticky bottom banner (dismissible)
 * • level === "urgent"   → blocking modal (cannot be dismissed, only extended)
 * • level === "expired"  → modal locked with "Sign in again" only
 *
 * Sensitive payroll data is never shown or inferred from session state.
 * The component delegates expiry handling to the caller via `onExpired`.
 *
 * Usage
 * ─────
 *   <SessionTimeoutWarning
 *     warningThresholdMs={10 * 60 * 1000}
 *     urgentThresholdMs={2 * 60 * 1000}
 *     onExtend={async () => { await fetch("/api/auth/extend", { method: "POST" }); }}
 *     onExpired={() => router.push("/login")}
 *   />
 */

import { useEffect, useRef } from "react";
import { Clock, AlertTriangle, LogIn, Loader2 } from "lucide-react";
import {
  useSessionTimeoutWarning,
  type UseSessionTimeoutWarningOptions,
} from "@/hooks/useSessionTimeoutWarning";
import { cn } from "@/lib/utils";

type SessionTimeoutWarningProps = UseSessionTimeoutWarningOptions;

export function SessionTimeoutWarning(props: SessionTimeoutWarningProps) {
  const {
    level,
    formattedTimeRemaining,
    isExtending,
    extend,
    dismiss,
    dismissed,
  } = useSessionTimeoutWarning(props);

  // Trap focus inside the modal when it is blocking.
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((level === "urgent" || level === "expired") && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable[0]?.focus();
    }
  }, [level]);

  if (level === "idle") return null;
  if (level === "warning" && dismissed) return null;

  // ── Blocking modal for urgent / expired ──────────────────────────────────
  if (level === "urgent" || level === "expired") {
    const isExpired = level === "expired";

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-description"
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        data-testid="session-timeout-modal"
      >
        <div
          ref={modalRef}
          className={cn(
            "relative mx-4 w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl",
            isExpired ? "border-red-200" : "border-amber-200",
          )}
        >
          {/* Icon + Title */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
                isExpired
                  ? "bg-red-100 text-red-600"
                  : "bg-amber-100 text-amber-600",
              )}
            >
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2
              id="session-timeout-title"
              className={cn(
                "text-base font-semibold",
                isExpired ? "text-red-800" : "text-amber-800",
              )}
            >
              {isExpired ? "Session expired" : "Session expiring soon"}
            </h2>
          </div>

          {/* Description */}
          <p
            id="session-timeout-description"
            className="mt-3 text-sm text-gray-700"
          >
            {isExpired
              ? "Your session has expired. Sign in again to continue. Any unsaved progress in the current payroll run has been preserved."
              : `Your session will expire in ${formattedTimeRemaining}. Extend it now to avoid interrupting the current payroll run.`}
          </p>

          {/* Actions */}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:gap-3">
            {isExpired ? (
              <a
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Sign in again
              </a>
            ) : (
              <button
                type="button"
                onClick={extend}
                disabled={isExtending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-60"
                aria-busy={isExtending}
              >
                {isExtending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                )}
                {isExtending ? "Extending…" : "Extend session"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Sticky banner for the softer "warning" level ─────────────────────────
  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4"
      data-testid="session-timeout-banner"
    >
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
        <Clock
          className="h-5 w-5 flex-shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <p className="flex-1 text-sm text-amber-800">
          <span className="font-semibold">Session expiring — </span>
          {formattedTimeRemaining}. Extend to keep your payroll work safe.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={extend}
            disabled={isExtending}
            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-60"
            aria-busy={isExtending}
          >
            {isExtending ? "Extending…" : "Extend"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
            aria-label="Dismiss session timeout warning"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
