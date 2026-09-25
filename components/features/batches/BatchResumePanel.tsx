"use client";

import { useState, useCallback } from "react";
import {
  Play,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Info,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { PayrollActionLoader } from "@/components/ui/PayrollActionLoader";
import type { PayrollLoadingPhase } from "@/components/ui/PayrollActionLoader";
import type { PayrollRun } from "@/types/models";

interface BatchResumePanelProps {
  /** The interrupted payroll run to be resumed. */
  run: PayrollRun;
  /**
   * Called after a successful resume so the parent can update its local
   * state (e.g. remove the run from the "interrupted" list).
   */
  onResumed?: (runId: string) => void;
}

/**
 * Panel that lets an admin safely continue an interrupted batch payroll run
 * after reviewing its state.
 *
 * Safety features:
 * - Requires explicit acknowledgement checkbox before enabling Resume.
 * - Displays the run ID and employee count — never raw salary amounts.
 * - Accessible: all interactive states are announced via aria-live region
 *   (delegated to PayrollActionLoader), and the form is keyboard-navigable.
 */
export function BatchResumePanel({ run, onResumed }: BatchResumePanelProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<PayrollLoadingPhase>("idle");
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleResume = useCallback(async () => {
    if (!acknowledged) return;

    setPhase("submitting");
    setResumeError(null);

    try {
      const res = await fetch(`/api/payroll/${run.id}/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // In production this would be a real session token.
          Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYWRtaW4iLCJwdWJsaWNLZXkiOiJHQUFaSjQifQ.sig",
        },
        body: JSON.stringify({
          reviewedAt: new Date().toISOString(),
          acknowledgedInterruption: true,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        const msg =
          data?.error?.message ??
          "Resume request failed. Please check the run status and try again.";
        throw new Error(msg);
      }

      setPhase("success");
      setSucceeded(true);
      toast.success("Batch payroll resumed", {
        description: `Run ${run.id} has been re-queued for processing.`,
      });
      onResumed?.(run.id);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. No changes were made to the payroll run.";
      setPhase("error");
      setResumeError(message);
      toast.error("Failed to resume payroll run", {
        description: "No payroll data was changed.",
      });
    }
  }, [acknowledged, note, run.id, onResumed]);

  if (succeeded) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3"
      >
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" aria-hidden="true" />
        <p className="text-sm font-medium text-green-800">
          Run {run.id} resumed and re-queued for processing.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-labelledby={`resume-heading-${run.id}`}
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="w-5 h-5 text-amber-600 mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div>
          <h3
            id={`resume-heading-${run.id}`}
            className="text-sm font-semibold text-amber-900"
          >
            Interrupted Batch Run
          </h3>
          <p className="text-xs text-amber-700 mt-0.5">
            This payroll run was interrupted before completing. Review its state
            below, then resume when ready.
          </p>
        </div>
      </div>

      {/* Run summary — no raw salary amounts */}
      <div className="rounded-md border border-amber-200 bg-white px-4 py-3 space-y-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-gray-500">
          <ClipboardList className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="font-medium text-gray-700">Run summary</span>
        </div>
        <div className="grid grid-cols-2 gap-y-1 text-xs pl-5">
          <span className="text-gray-500">Run ID</span>
          <span className="font-mono text-gray-800">{run.id}</span>

          <span className="text-gray-500">Employees</span>
          <span className="text-gray-800">{run.employeeCount}</span>

          <span className="text-gray-500">Status</span>
          <span className="capitalize text-amber-700 font-medium">
            {run.status}
          </span>

          {run.reconciliationStatus && (
            <>
              <span className="text-gray-500">Reconciliation</span>
              <span className="capitalize text-gray-700">
                {run.reconciliationStatus}
              </span>
            </>
          )}

          <span className="text-gray-500">Interrupted</span>
          <span className="text-gray-800">
            {new Date(run.timestamp).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </div>

      {/* Inline accessible loader */}
      <PayrollActionLoader
        phase={phase}
        actionLabel="Resuming batch payroll run"
        errorMessage={resumeError ?? undefined}
      />

      {/* Optional note */}
      <div>
        <label
          htmlFor={`resume-note-${run.id}`}
          className="block text-xs font-medium text-gray-700 mb-1"
        >
          Resume note{" "}
          <span className="text-gray-400 font-normal">(optional, max 500 chars)</span>
        </label>
        <textarea
          id={`resume-note-${run.id}`}
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe what was reviewed before resuming…"
          disabled={phase === "submitting"}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 resize-none"
        />
        <div className="flex items-start gap-1.5 mt-1.5">
          <Info className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs text-gray-500">
            Do not include raw salary amounts or wallet keys in this note.
          </p>
        </div>
      </div>

      {/* Acknowledgement checkbox */}
      <div className="flex items-start gap-3">
        <input
          id={`resume-ack-${run.id}`}
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          disabled={phase === "submitting"}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded mt-0.5 focus:ring-indigo-500 disabled:opacity-50"
        />
        <label
          htmlFor={`resume-ack-${run.id}`}
          className="text-xs text-gray-700 cursor-pointer select-none"
        >
          I have reviewed the interrupted run state and confirm it is safe to
          re-queue this batch for processing. I understand this action will be
          recorded in the audit trail.
        </label>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleResume}
          disabled={!acknowledged || phase === "submitting"}
          aria-disabled={!acknowledged || phase === "submitting"}
          aria-label={
            !acknowledged
              ? "Resume run — check the acknowledgement box first"
              : "Resume interrupted batch payroll run"
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {phase === "submitting" ? (
            <RotateCcw className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4" aria-hidden="true" />
          )}
          {phase === "submitting" ? "Resuming…" : "Resume Run"}
        </button>

        {phase === "error" && (
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setResumeError(null);
            }}
            className="text-xs text-gray-500 underline hover:text-gray-700"
          >
            Dismiss error
          </button>
        )}
      </div>
    </section>
  );
}
