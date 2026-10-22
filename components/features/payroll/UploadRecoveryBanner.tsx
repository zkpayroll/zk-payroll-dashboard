"use client";

/**
 * UploadRecoveryBanner
 *
 * Shown when the operator returns to the payroll wizard and a non-completed
 * upload checkpoint exists in localStorage. Surfaces the interrupted stage,
 * a plain-language recovery hint, and two actions: resume (scroll to wizard)
 * or discard (clear the checkpoint and start fresh).
 *
 * Privacy contract
 * ─────────────────
 * This component only reads structural metadata from the checkpoint store —
 * stage, employeeCount, proofReady, savedAt. It never renders salary amounts,
 * employee IDs, wallet addresses, or ZK proof data.
 */

import { useEffect } from "react";
import { RotateCcw, X, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { usePayrollUploadCheckpointStore } from "@/stores/payrollUploadCheckpoint";
import type { UploadCheckpointStage } from "@/types/models";

// ─── Stage display helpers ────────────────────────────────────────────────────

const STAGE_LABELS: Record<UploadCheckpointStage, string> = {
  draft_started: "Review",
  proof_generated: "Proof Generation",
  confirmed: "Confirmation",
  submitting: "Submission",
  completed: "Completed",
};

const STAGE_COLORS: Record<UploadCheckpointStage, { bg: string; border: string; text: string; badge: string }> = {
  draft_started: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    badge: "bg-blue-100 text-blue-800",
  },
  proof_generated: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-900",
    badge: "bg-indigo-100 text-indigo-800",
  },
  confirmed: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-900",
    badge: "bg-violet-100 text-violet-800",
  },
  submitting: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    badge: "bg-amber-100 text-amber-800",
  },
  completed: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-900",
    badge: "bg-green-100 text-green-800",
  },
};

/** Returns a relative time string without exposing amounts (e.g. "3 minutes ago"). */
function formatAge(savedAt: string): string {
  const diffMs = Date.now() - new Date(savedAt).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UploadRecoveryBannerProps {
  /**
   * Called when the operator clicks "Resume". The parent wizard should
   * restore its state (e.g. call `restoreDraft()`) in this callback.
   */
  onResume: () => void;
  /**
   * Called after the operator confirms discarding the checkpoint. The banner
   * clears the checkpoint from the store before firing this callback.
   */
  onDiscard?: () => void;
  /**
   * Restrict the banner to a specific run. When provided the banner only
   * shows if the stored checkpoint belongs to this runId.
   */
  runId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * UploadRecoveryBanner
 *
 * Reads the checkpoint store directly so no prop drilling is needed.
 * Renders nothing when there is no recoverable checkpoint.
 */
export function UploadRecoveryBanner({
  onResume,
  onDiscard,
  runId,
}: UploadRecoveryBannerProps) {
  const checkpoint = usePayrollUploadCheckpointStore((s) => s.checkpoint);
  const hasRecoverableCheckpoint = usePayrollUploadCheckpointStore(
    (s) => s.hasRecoverableCheckpoint,
  );
  const isRunRecoverable = usePayrollUploadCheckpointStore(
    (s) => s.isRunRecoverable,
  );
  const clearCheckpoint = usePayrollUploadCheckpointStore(
    (s) => s.clearCheckpoint,
  );
  const evictStaleCheckpoint = usePayrollUploadCheckpointStore(
    (s) => s.evictStaleCheckpoint,
  );

  // Evict stale checkpoints (>24 h) on mount so a banner never shows for an
  // ancient interrupted session without the operator being aware.
  useEffect(() => {
    evictStaleCheckpoint();
  }, [evictStaleCheckpoint]);

  // Determine visibility.
  const isVisible = runId
    ? isRunRecoverable(runId)
    : hasRecoverableCheckpoint();

  if (!isVisible || !checkpoint) return null;

  const colors = STAGE_COLORS[checkpoint.stage];
  const stageLabel = STAGE_LABELS[checkpoint.stage];
  const ageLabel = formatAge(checkpoint.savedAt);

  function handleDiscard() {
    clearCheckpoint();
    onDiscard?.();
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label={`Interrupted payroll upload detected at the ${stageLabel} step`}
      className={`${colors.bg} ${colors.border} border rounded-lg p-4 flex items-start gap-3`}
    >
      {/* Icon */}
      <AlertTriangle
        className={`mt-0.5 h-5 w-5 shrink-0 ${colors.text}`}
        aria-hidden="true"
      />

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className={`text-sm font-semibold ${colors.text}`}>
            Interrupted payroll upload detected
          </h3>
          {/* Stage badge */}
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors.badge}`}
            aria-label={`Interrupted at step: ${stageLabel}`}
          >
            {stageLabel}
          </span>
          {/* Proof badge */}
          {checkpoint.proofReady && (
            <span
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800"
              aria-label="ZK proof was ready at the time of interruption"
            >
              <CheckCircle className="h-3 w-3" aria-hidden="true" />
              Proof ready
            </span>
          )}
        </div>

        {/* Recovery hint — must not contain amounts or employee data */}
        <p className={`text-sm ${colors.text} opacity-90`}>
          {checkpoint.recoveryHint}
        </p>

        {/* Metadata row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs opacity-70">
          <span
            className={`inline-flex items-center gap-1 ${colors.text}`}
            aria-label={`${checkpoint.employeeCount} employees in this batch`}
          >
            {checkpoint.employeeCount} employee{checkpoint.employeeCount !== 1 ? "s" : ""}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${colors.text}`}
            aria-label={`Checkpoint saved ${ageLabel}`}
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            {ageLabel}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
            aria-label={`Resume payroll upload from the ${stageLabel} step`}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Resume upload
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/60 transition-colors"
            aria-label="Discard interrupted upload and start a new payroll run"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Discard and start fresh
          </button>
        </div>
      </div>
    </div>
  );
}
