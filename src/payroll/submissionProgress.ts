import type {
  PayrollEvent,
  PayrollStage,
} from "@/src/observability/types";
import type { PayrollRun } from "@/types/models";

/**
 * Payroll submission progress stepper stages (issue #295).
 *
 * Kept as pure functions so the stage derivation is testable without
 * rendering the stepper, and so the same lifecycle view can be reused across
 * the payroll wizard (in-flight runs) and run detail pages (historical runs).
 *
 * PRIVACY: stage states are derived exclusively from lifecycle state fields
 * (wizard step/submission state, run status, approval status, reconciliation
 * outcome). No amounts, employee identifiers, wallet addresses, proofs, or
 * hashes are ever read or surfaced — the stepper shows stage labels and
 * states only, so it is safe to render anywhere the underlying run is safe
 * to render.
 */

export type SubmissionStageKey =
  | "validation"
  | "approval"
  | "signing"
  | "submission"
  | "confirmation"
  | "reconciliation";

export interface SubmissionStageDefinition {
  key: SubmissionStageKey;
  label: string;
  /** Short help text shown under the label in the stepper (state-only). */
  description: string;
}

/**
 * The canonical ordered stage list for a payroll submission.
 */
export const SUBMISSION_STAGES: readonly SubmissionStageDefinition[] = [
  {
    key: "validation",
    label: "Validation",
    description: "Run data, treasury, and proof checks",
  },
  {
    key: "approval",
    label: "Approval",
    description: "Executive sign-off on the run",
  },
  {
    key: "signing",
    label: "Signing",
    description: "Wallet signature on the batch transaction",
  },
  {
    key: "submission",
    label: "Submission",
    description: "Transaction broadcast to the network",
  },
  {
    key: "confirmation",
    label: "Confirmation",
    description: "On-chain inclusion verified",
  },
  {
    key: "reconciliation",
    label: "Reconciliation",
    description: "Payouts matched against the run",
  },
] as const;

export const SUBMISSION_STAGE_KEYS: readonly SubmissionStageKey[] =
  SUBMISSION_STAGES.map((stage) => stage.key);

/** Lifecycle state of a single stage in the stepper. */
export type SubmissionStageState =
  | "complete"
  | "active"
  | "pending"
  | "failed"
  | "skipped";

/** Derived per-stage state for the stepper. */
export interface SubmissionStageProgress {
  key: SubmissionStageKey;
  label: string;
  description: string;
  state: SubmissionStageState;
}

/** Input describing where a wizard-driven run currently is. */
export interface WizardProgressInput {
  source: "wizard";
  currentStep: "review" | "proof" | "confirm" | "submit";
  proofStatus: "idle" | "generating" | "success" | "error";
  submissionStatus: "idle" | "submitting" | "success" | "error";
  /** Stage reported as failed, if any (drives the stepper's failed marker). */
  failedStage?: SubmissionStageKey | null;
}

/** Input describing an observed (historical or in-flight) payroll run. */
export interface RunProgressInput {
  source: "run";
  run: Pick<
    PayrollRun,
    | "status"
    | "approvalStatus"
    | "reconciliationStatus"
    | "cancellationReason"
    | "transactionHash"
    | "txHash"
  >;
}

/** Inputs the stepper logic accepts. */
export type SubmissionProgressInput = WizardProgressInput | RunProgressInput;

/**
 * Derive the per-stage progress for the submission stepper.
 *
 * Stage order is canonical: validation → approval → signing → submission →
 * confirmation → reconciliation. Stages before the furthest-known stage are
 * `complete`; the furthest-known stage is `active` (or `failed`/`skipped` per
 * failure/cancellation state); later stages are `pending`.
 *
 * Failure semantics: when a stage fails, that stage is marked `failed` and
 * every later stage stays `pending` — the run cannot advance until retried.
 * Cancellation semantics: the stage where the run was cancelled is marked
 * `skipped` and later stages stay `pending`.
 */
export function getSubmissionStageProgress(
  input: SubmissionProgressInput,
): SubmissionStageProgress[] {
  const { currentStage, terminal } = deriveStagePosition(input);

  return SUBMISSION_STAGES.map((stage) => {
    let state: SubmissionStageState;
    if (terminal.stageKey === stage.key) {
      state = terminal.state;
    } else if (STAGE_ORDER[stage.key] < currentStage) {
      state = "complete";
      // A failed/skipped terminal stage poisons nothing behind it, but a
      // cancellation marks the stage itself as skipped, so any earlier stage
      // is simply complete.
    } else if (STAGE_ORDER[stage.key] === currentStage) {
      state = terminal.state === "failed" || terminal.state === "skipped"
        ? terminal.state
        : "active";
    } else {
      state = "pending";
    }

    // Cancellation: the cancelled-at stage is the terminal skipped stage; the
    // stage after it never becomes active.
    return {
      key: stage.key,
      label: stage.label,
      description: stage.description,
      state,
    };
  });
}

/**
 * Focused helper returning only the state for a single stage key. Useful for
 * compact surfaces (badges, drawer headers) that render one stage at a time.
 */
export function getStageState(
  input: SubmissionProgressInput,
  stageKey: SubmissionStageKey,
): SubmissionStageState {
  const progress = getSubmissionStageProgress(input);
  const found = progress.find((stage) => stage.key === stageKey);
  return found?.state ?? "pending";
}

/** A one-line, state-only summary of the run's progress. */
export function summarizeSubmissionProgress(
  input: SubmissionProgressInput,
): string {
  const progress = getSubmissionStageProgress(input);
  const active = progress.find(
    (stage) =>
      stage.state === "active" ||
      stage.state === "failed" ||
      stage.state === "skipped",
  );
  if (active) {
    switch (active.state) {
      case "active":
        return `In progress: ${active.label}`;
      case "failed":
        return `Failed at ${active.label}`;
      case "skipped":
        return `Cancelled at ${active.label}`;
    }
  }
  const completeCount = progress.filter(
    (stage) => stage.state === "complete",
  ).length;
  if (completeCount === progress.length) {
    return "All stages complete";
  }
  return "Not started";
}

interface StagePosition {
  /** Index of the furthest-known stage (0-based). */
  currentStage: number;
  /** Terminal state applied to that stage. */
  terminal: { stageKey: SubmissionStageKey; state: SubmissionStageState };
}

const STAGE_ORDER: Record<SubmissionStageKey, number> = {
  validation: 0,
  approval: 1,
  signing: 2,
  submission: 3,
  confirmation: 4,
  reconciliation: 5,
};

function deriveStagePosition(
  input: SubmissionProgressInput,
): StagePosition {
  if (input.source === "wizard") {
    return deriveWizardPosition(input);
  }
  return deriveRunPosition(input);
}

/**
 * Wizard-driven derivation.
 *
 * Mapping from the wizard's own state machine:
 * - `review`/`proof` steps: still validating (proof generation is part of
 *   pre-submission validation).
 * - `confirm` step: validation passed, awaiting approval/sign-off.
 * - `submit` step: signing + submission in progress; terminal state follows
 *   `submissionStatus`.
 */
function deriveWizardPosition(input: WizardProgressInput): StagePosition {
  if (input.currentStep === "submit") {
    const failureStage: SubmissionStageKey =
      input.failedStage ?? "submission";
    switch (input.submissionStatus) {
      case "submitting":
        return {
          currentStage: STAGE_ORDER.signing,
          terminal: { stageKey: "signing", state: "active" },
        };
      case "success":
        // From the wizard's perspective the run has been broadcast and its
        // receipt issued; confirmation/reconciliation settle afterwards.
        return {
          currentStage: STAGE_ORDER.submission,
          terminal: { stageKey: "submission", state: "complete" },
        };
      case "error":
        return {
          currentStage: STAGE_ORDER[failureStage],
          terminal: { stageKey: failureStage, state: "failed" },
        };
      default:
        // `idle` on the submit step: arriving but not yet signing.
        return {
          currentStage: STAGE_ORDER.signing,
          terminal: { stageKey: "signing", state: "active" },
        };
    }
  }

  if (input.currentStep === "confirm") {
    // Validation succeeded to reach this step; approval is the stage in
    // progress (explicit sign-off happens on this step).
    return {
      currentStage: STAGE_ORDER.approval,
      terminal: { stageKey: "approval", state: "active" },
    };
  }

  // review / proof: validation in progress. A proof error fails validation
  // unless a more specific stage was reported.
  if (input.proofStatus === "error") {
    return {
      currentStage: STAGE_ORDER.validation,
      terminal: { stageKey: "validation", state: "failed" },
    };
  }
  return {
    currentStage: STAGE_ORDER.validation,
    terminal: { stageKey: "validation", state: "active" },
  };
}

/**
 * Run-driven derivation for historical/in-flight runs surfaced on detail and
 * history pages.
 *
 * Precedence: cancelled → failed → reconciliation → confirmed → submitted →
 * approval state → validation.
 */
function deriveRunPosition(input: RunProgressInput): StagePosition {
  const { run } = input;
  const txHash = run.transactionHash ?? run.txHash;

  if (run.status === "cancelled") {
    const cancelledAt = cancelStageForReason(run.cancellationReason);
    return {
      currentStage: STAGE_ORDER[cancelledAt],
      terminal: { stageKey: cancelledAt, state: "skipped" },
    };
  }

  if (run.status === "failed") {
    return {
      currentStage: STAGE_ORDER.submission,
      terminal: { stageKey: "submission", state: "failed" },
    };
  }

  if (run.status === "verified") {
    if (run.reconciliationStatus === "failed") {
      return {
        currentStage: STAGE_ORDER.reconciliation,
        terminal: { stageKey: "reconciliation", state: "failed" },
      };
    }
    if (
      run.reconciliationStatus === "complete" ||
      run.reconciliationStatus === "partial"
    ) {
      return {
        currentStage: STAGE_ORDER.reconciliation,
        terminal: { stageKey: "reconciliation", state: "complete" },
      };
    }
    // Verified but not yet reconciled: confirmation done, reconciliation
    // in progress.
    return {
      currentStage: STAGE_ORDER.reconciliation,
      terminal: { stageKey: "reconciliation", state: "active" },
    };
  }

  // status === "pending": in flight.
  if (txHash) {
    // Broadcast and awaiting on-chain confirmation.
    return {
      currentStage: STAGE_ORDER.confirmation,
      terminal: { stageKey: "confirmation", state: "active" },
    };
  }

  if (run.approvalStatus === "rejected") {
    return {
      currentStage: STAGE_ORDER.approval,
      terminal: { stageKey: "approval", state: "failed" },
    };
  }

  if (run.approvalStatus === "approved") {
    return {
      currentStage: STAGE_ORDER.signing,
      terminal: { stageKey: "signing", state: "active" },
    };
  }

  if (
    run.approvalStatus === "pending_executive_approval" ||
    run.approvalStatus === "correction_requested"
  ) {
    return {
      currentStage: STAGE_ORDER.approval,
      terminal: { stageKey: "approval", state: "active" },
    };
  }

  // No approval state yet: validation in progress.
  return {
    currentStage: STAGE_ORDER.validation,
    terminal: { stageKey: "validation", state: "active" },
  };
}

/**
 * Map a cancellation reason to the stage where the run stopped.
 */
export function cancelStageForReason(
  reason: PayrollRun["cancellationReason"],
): SubmissionStageKey {
  switch (reason) {
    case "treasury_insufficient":
      return "validation";
    case "approval_rejected":
      return "approval";
    case "compliance_hold":
      return "approval";
    case "duplicate_batch":
      return "validation";
    case "expired_proof":
      return "validation";
    case "manual_request":
      return "submission";
    case "unknown":
    default:
      return "submission";
  }
}

/**
 * Derive stepper progress from the payroll event timeline (observability
 * events). This mirrors the run-based derivation but uses the event stream,
 * which is what incident tooling already consumes. The most recent relevant
 * event per stage wins.
 *
 * PRIVACY: events are redacted upstream by the observability emitter; this
 * function reads only `stage`/`status` fields.
 */
export function getSubmissionStageProgressFromEvents(
  events: Pick<PayrollEvent, "stage" | "status">[],
): SubmissionStageProgress[] {
  // Latest status per stage; the newest occurrence of an event stage wins.
  const latestStatusByStage = new Map<SubmissionStageKey, PayrollEvent["status"]>();

  for (const event of events) {
    const mapped = EVENT_STAGE_TO_SUBMISSION_STAGE[event.stage as PayrollStage];
    if (!mapped) continue;
    latestStatusByStage.set(mapped, event.status);
  }

  if (latestStatusByStage.size === 0) {
    // No events: nothing started.
    return SUBMISSION_STAGES.map((stage) => ({
      ...stage,
      state: "pending" as const,
    }));
  }

  // Furthest stage that recorded any event. Events may be non-contiguous
  // (incident tooling can emit only failures, for example), so scan every
  // stage instead of stopping at the first gap.
  let furthestOrder = STAGE_ORDER.validation;
  for (const stage of SUBMISSION_STAGE_KEYS) {
    if (latestStatusByStage.has(stage)) {
      furthestOrder = Math.max(furthestOrder, STAGE_ORDER[stage]);
    }
  }

  return SUBMISSION_STAGES.map((stage) => {
    const status = latestStatusByStage.get(stage.key);
    let state: SubmissionStageState;
    if (status === "failed") {
      state = "failed";
    } else if (status === "succeeded") {
      state = "complete";
    } else if (status === "started" || status === "retried") {
      state = "active";
    } else if (STAGE_ORDER[stage.key] < furthestOrder) {
      // No event recorded for this stage, but a later stage progressed —
      // the later stage implies this one happened (e.g. signing started
      // implies approval completed), even if it was never recorded.
      state = "complete";
    } else {
      state = "pending";
    }
    return {
      key: stage.key,
      label: stage.label,
      description: stage.description,
      state,
    };
  });
}

const EVENT_STAGE_TO_SUBMISSION_STAGE: Partial<
  Record<PayrollStage, SubmissionStageKey>
> = {
  validation: "validation",
  draft: "validation",
  draft_updated: "validation",
  proof_setup: "validation",
  wallet_signing: "signing",
  tx_submission: "submission",
  polling: "confirmation",
  reconciliation: "reconciliation",
};
