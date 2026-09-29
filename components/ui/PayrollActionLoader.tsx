"use client";

import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { usePayrollLoadingAnnouncer } from "@/hooks/usePayrollLoadingAnnouncer";
import type { PayrollLoadingPhase } from "@/hooks/usePayrollLoadingAnnouncer";

export type { PayrollLoadingPhase };

interface PayrollActionLoaderProps {
  /** Current phase of the async payroll action. */
  phase: PayrollLoadingPhase;
  /**
   * Human-readable label for the in-progress action — shown beneath the
   * spinner and used to compose the accessible button label.
   * Must not include raw salary values or wallet keys.
   */
  actionLabel: string;
  /**
   * Optional safe, non-sensitive error message to display when phase is
   * "error".  Never pass raw amounts or cryptographic data here.
   */
  errorMessage?: string | null;
  className?: string;
}

/**
 * Renders an animated loading indicator, success confirmation, or error state
 * for in-progress payroll actions.
 *
 * Accessibility features:
 * - A visually-hidden `aria-live="assertive"` region announces phase
 *   transitions to screen readers without requiring focus movement.
 * - The visible container carries `role="status"` during loading and
 *   `role="alert"` on error so AT users receive immediate feedback.
 * - All decorative icons have `aria-hidden="true"`.
 * - The spinner is never the only visual cue — a text label is always shown.
 */
export function PayrollActionLoader({
  phase,
  actionLabel,
  errorMessage,
  className = "",
}: PayrollActionLoaderProps) {
  const announceRef = usePayrollLoadingAnnouncer(phase);

  if (phase === "idle") return null;

  return (
    <>
      {/* Visually-hidden live region for screen-reader announcements */}
      <div
        ref={announceRef}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />

      {phase === "generating" || phase === "submitting" ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={`${actionLabel} in progress`}
          className={`flex flex-col items-center gap-3 py-6 ${className}`}
        >
          <Loader2
            className="w-8 h-8 text-indigo-600 animate-spin"
            aria-hidden="true"
          />
          <p className="text-sm text-gray-600">{actionLabel}…</p>
          {/* Progress bar — purely decorative, aria-hidden */}
          <div
            className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden"
            aria-hidden="true"
          >
            <div className="h-full bg-indigo-600 rounded-full animate-pulse w-3/5" />
          </div>
        </div>
      ) : phase === "success" ? (
        <div
          role="status"
          aria-label={`${actionLabel} completed successfully`}
          className={`flex items-center gap-2 text-green-700 ${className}`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium">Completed successfully</span>
        </div>
      ) : phase === "error" ? (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 ${className}`}
        >
          <AlertCircle
            className="w-4 h-4 text-red-600 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm text-red-700">
            {errorMessage ??
              "An error occurred. Check the details above and try again."}
          </p>
        </div>
      ) : null}
    </>
  );
}

/**
 * Generates the accessible label for a button that triggers a payroll action.
 *
 * Usage:
 * ```tsx
 * <button aria-label={getPayrollButtonAriaLabel("Generate Proof", proofPhase)}>
 *   Generate Proof
 * </button>
 * ```
 */
export function getPayrollButtonAriaLabel(
  label: string,
  phase: PayrollLoadingPhase,
): string {
  if (phase === "generating" || phase === "submitting")
    return `${label} — in progress, please wait`;
  if (phase === "success") return `${label} — completed`;
  if (phase === "error") return `${label} — failed, activate to retry`;
  return label;
}
