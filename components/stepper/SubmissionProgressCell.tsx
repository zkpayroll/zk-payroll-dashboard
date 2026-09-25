"use client";

import {
  getSubmissionStageProgress,
  summarizeSubmissionProgress,
  type SubmissionProgressInput,
  type SubmissionStageState,
} from "@/src/payroll/submissionProgress";

/**
 * Compact inline submission progress for table rows (issue #295).
 *
 * Renders the six lifecycle stages as small state dots with a screen-reader
 * summary, so history rows answer "where is this payroll?" at a glance
 * without adding a full stepper per row.
 *
 * PRIVACY: state-only. Stage labels and states are static strings; no
 * amounts, employee data, wallet addresses, proofs, or hashes are accepted
 * or rendered.
 */

const DOT_STYLES: Record<SubmissionStageState, string> = {
  complete: "bg-green-500",
  active: "bg-indigo-500 animate-pulse",
  pending: "bg-gray-200",
  failed: "bg-red-500",
  skipped: "bg-gray-400",
};

const STATE_LABELS: Record<SubmissionStageState, string> = {
  complete: "Complete",
  active: "In progress",
  pending: "Pending",
  failed: "Failed",
  skipped: "Skipped",
};

export function SubmissionProgressCell({
  input,
}: {
  input: SubmissionProgressInput;
}) {
  const stages = getSubmissionStageProgress(input);
  const summary = summarizeSubmissionProgress(input);

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`Submission progress: ${summary}`}
      title={summary}
    >
      {stages.map((stage) => (
        <span
          key={stage.key}
          data-testid={`progress-${stage.key}`}
          data-stage={stage.key}
          data-state={stage.state}
          className={`inline-block h-2 w-2 rounded-full ${DOT_STYLES[stage.state]}`}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">
        Submission progress: {summary} —{" "}
        {stages
          .map((s) => `${s.label}: ${STATE_LABELS[s.state]}`)
          .join(", ")}.
      </span>
    </div>
  );
}

export default SubmissionProgressCell;
