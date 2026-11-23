"use client";

import { Check, Loader2, Minus, AlertCircle, Ban } from "lucide-react";
import {
  SUBMISSION_STAGES,
  getSubmissionStageProgress,
  type SubmissionProgressInput,
  type SubmissionStageState,
} from "@/src/payroll/submissionProgress";
import { cn } from "@/lib/utils";

/**
 * Accessible payroll submission progress stepper (issue #295).
 *
 * Shows the six lifecycle stages — validation, approval, signing,
 * submission, confirmation, reconciliation — with clear states: complete,
 * active, pending, failed, and skipped (cancelled).
 *
 * PRIVACY: renders lifecycle state only. Stage labels and states are
 * static strings; no amounts, employee data, wallet addresses, proofs, or
 * hashes are ever accepted or rendered by this component.
 */

const STATE_STYLES: Record<
  SubmissionStageState,
  { circle: string; text: string; connector: string; label: string }
> = {
  complete: {
    circle: "bg-green-600 border-green-600 text-white",
    text: "text-gray-900",
    connector: "bg-green-400",
    label: "Complete",
  },
  active: {
    circle: "border-indigo-600 text-indigo-600 bg-white",
    text: "text-gray-900",
    connector: "bg-gray-200",
    label: "In progress",
  },
  pending: {
    circle: "border-gray-300 text-gray-300 bg-white",
    text: "text-gray-400",
    connector: "bg-gray-200",
    label: "Pending",
  },
  failed: {
    circle: "bg-red-600 border-red-600 text-white",
    text: "text-red-700",
    connector: "bg-gray-200",
    label: "Failed",
  },
  skipped: {
    circle: "bg-gray-400 border-gray-400 text-white",
    text: "text-gray-500",
    connector: "bg-gray-200",
    label: "Skipped",
  },
};

function StateIcon({ state }: { state: SubmissionStageState }) {
  const common = "w-4 h-4";
  switch (state) {
    case "complete":
      return <Check className={common} aria-hidden="true" />;
    case "active":
      return <Loader2 className={`${common} animate-spin`} aria-hidden="true" />;
    case "failed":
      return <AlertCircle className={common} aria-hidden="true" />;
    case "skipped":
      return <Ban className={common} aria-hidden="true" />;
    default:
      return <Minus className={common} aria-hidden="true" />;
  }
}

export interface PayrollSubmissionStepperProps {
  /** Where to derive stage progress from (wizard state or a payroll run). */
  input: SubmissionProgressInput;
  /** Compact layout for embeds (detail sheets, drawers). */
  compact?: boolean;
  /** Hide the per-stage description text (state labels remain). */
  hideDescriptions?: boolean;
  className?: string;
}

export function PayrollSubmissionStepper({
  input,
  compact = false,
  hideDescriptions = false,
  className,
}: PayrollSubmissionStepperProps) {
  const stages = getSubmissionStageProgress(input);

  return (
    <nav
      aria-label="Payroll submission progress"
      className={cn("w-full", className)}
    >
      <ol
        className={cn(
          "flex flex-col",
          compact ? "gap-1" : "gap-2 sm:flex-row sm:gap-0",
        )}
      >
        {stages.map((stage, index) => {
          const styles = STATE_STYLES[stage.state];
          const isLast = index === stages.length - 1;
          return (
            <li
              key={stage.key}
              className={cn(
                "flex items-start",
                compact ? "gap-2.5" : "sm:flex-1 sm:gap-0",
              )}
              data-testid={`stage-${stage.key}`}
              data-stage={stage.key}
              data-state={stage.state}
            >
              <div className="flex shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border-2",
                    compact ? "h-6 w-6" : "h-8 w-8",
                    styles.circle,
                  )}
                  aria-hidden="true"
                >
                  <StateIcon state={stage.state} />
                </span>
                {!isLast && (
                  <span
                    className={cn(
                      "mt-1 w-0.5 flex-1 rounded-full",
                      styles.connector,
                      "sm:hidden",
                    )}
                  />
                )}
              </div>
              <div
                className={cn(
                  "min-w-0 pb-2",
                  compact ? "pt-0.5" : "pt-1",
                  !isLast && "sm:pr-4",
                )}
              >
                <span
                  className={cn(
                    "block text-sm font-medium",
                    compact && "text-xs",
                    styles.text,
                  )}
                >
                  {stage.label}
                  <span className="sr-only">: {styles.label}</span>
                </span>
                {!hideDescriptions && !compact && (
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {stage.description}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default PayrollSubmissionStepper;
