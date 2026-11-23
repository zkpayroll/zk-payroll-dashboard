"use client";

/**
 * #470 – PayrollRunProgressBanner
 *
 * Shown at the top of the payroll page when the user returns after a refresh
 * and there is an unfinished payroll run stored in the persistent progress
 * snapshot.  Displays safe, non-sensitive progress metadata and offers two
 * actions: resume the run (navigates to the wizard) or dismiss and discard
 * the snapshot.
 *
 * Sensitive fields (amounts, IDs, proof data) are never shown.
 */

import { useEffect, useState } from "react";
import { History, X, ArrowRight } from "lucide-react";
import { usePayrollRunProgressStore } from "@/stores/payrollRunProgress";
import { cn } from "@/lib/utils";

const STEP_LABELS: Record<string, string> = {
  review: "Reviewing employees",
  proof: "Generating ZK proof",
  confirm: "Awaiting confirmation",
  submit: "Submitting to network",
};

interface PayrollRunProgressBannerProps {
  /** Called when the operator clicks "Resume". The parent should navigate
   *  to the payroll wizard and restore the active draft. */
  onResume: () => void;
  className?: string;
}

export function PayrollRunProgressBanner({
  onResume,
  className,
}: PayrollRunProgressBannerProps) {
  const snapshot = usePayrollRunProgressStore((s) => s.snapshot);
  const clearProgress = usePayrollRunProgressStore((s) => s.clearProgress);
  const hasResumableRun = usePayrollRunProgressStore((s) => s.hasResumableRun);

  // Delay mounting until hydration is complete so SSR matches the server
  // render (server has no localStorage, so snapshot is always null there).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated || !hasResumableRun() || !snapshot) return null;

  const stepLabel = STEP_LABELS[snapshot.currentStep] ?? snapshot.currentStep;

  // Format updatedAt as a relative or absolute time — we deliberately avoid
  // exposing the batch amount or any employee count beyond a safe integer.
  const lastUpdated = new Date(snapshot.updatedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDismiss = () => clearProgress();

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm",
        className,
      )}
      data-testid="payroll-run-progress-banner"
    >
      <History
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          Unfinished payroll run detected
        </p>
        <p className="mt-0.5 text-xs text-amber-700">
          A batch of{" "}
          <span className="font-medium">{snapshot.employeeCount}</span>{" "}
          {snapshot.employeeCount === 1 ? "employee" : "employees"} was
          interrupted at the{" "}
          <span className="font-medium">{stepLabel}</span> step. Last saved{" "}
          at {lastUpdated}.
        </p>
        {snapshot.proofReady && !snapshot.submitted && (
          <p className="mt-1 text-xs text-amber-600">
            A ZK proof was generated for this batch. Resuming will let you
            proceed directly to submission.
          </p>
        )}

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
            aria-label="Resume unfinished payroll run"
          >
            Resume run
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-medium text-amber-700 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 rounded"
            aria-label="Discard unfinished payroll run and dismiss this notice"
          >
            Discard and dismiss
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="ml-auto flex-shrink-0 rounded-lg p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
        aria-label="Dismiss progress banner"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
