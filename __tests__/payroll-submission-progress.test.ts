import { describe, it, expect } from "vitest";
import {
  SUBMISSION_STAGES,
  SUBMISSION_STAGE_KEYS,
  getSubmissionStageProgress,
  getStageState,
  summarizeSubmissionProgress,
  cancelStageForReason,
  getSubmissionStageProgressFromEvents,
  type WizardProgressInput,
  type RunProgressInput,
} from "@/src/payroll/submissionProgress";

const baseRun: RunProgressInput["run"] = {
  status: "pending",
  approvalStatus: "draft",
  reconciliationStatus: undefined,
  cancellationReason: undefined,
  transactionHash: undefined,
  txHash: undefined,
};

function runInput(overrides: Partial<RunProgressInput["run"]>): RunProgressInput {
  return { source: "run", run: { ...baseRun, ...overrides } };
}

function wizardInput(
  overrides: Partial<Omit<WizardProgressInput, "source">>,
): WizardProgressInput {
  return {
    source: "wizard",
    currentStep: "review",
    proofStatus: "idle",
    submissionStatus: "idle",
    failedStage: null,
    ...overrides,
  };
}

function statesOf(progress: ReturnType<typeof getSubmissionStageProgress>) {
  return progress.map((stage) => stage.state);
}

describe("submission stage catalog", () => {
  it("exposes the six ordered stages from the issue", () => {
    expect(SUBMISSION_STAGE_KEYS).toEqual([
      "validation",
      "approval",
      "signing",
      "submission",
      "confirmation",
      "reconciliation",
    ]);
    expect(SUBMISSION_STAGES.length).toBe(6);
    for (const stage of SUBMISSION_STAGES) {
      expect(stage.label.length).toBeGreaterThan(0);
      expect(stage.description.length).toBeGreaterThan(0);
    }
  });
});

describe("wizard-driven progress", () => {
  it("marks validation active on the review step", () => {
    const progress = getSubmissionStageProgress(
      wizardInput({ currentStep: "review", proofStatus: "idle" }),
    );
    expect(statesOf(progress)).toEqual([
      "active",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks validation failed on proof error (failure path)", () => {
    const progress = getSubmissionStageProgress(
      wizardInput({ currentStep: "proof", proofStatus: "error" }),
    );
    expect(statesOf(progress)).toEqual([
      "failed",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(summarizeSubmissionProgress(wizardInput({ currentStep: "proof", proofStatus: "error" }))).toBe(
      "Failed at Validation",
    );
  });

  it("marks validation complete and approval active on the confirm step", () => {
    const progress = getSubmissionStageProgress(
      wizardInput({ currentStep: "confirm", proofStatus: "success" }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "active",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks signing active while submitting", () => {
    const progress = getSubmissionStageProgress(
      wizardInput({ currentStep: "submit", submissionStatus: "submitting" }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "active",
      "pending",
      "pending",
      "pending",
    ]);
    expect(summarizeSubmissionProgress(wizardInput({ currentStep: "submit", submissionStatus: "submitting" }))).toBe(
      "In progress: Signing",
    );
  });

  it("marks submission failed on submission error (failure path)", () => {
    const progress = getSubmissionStageProgress(
      wizardInput({ currentStep: "submit", submissionStatus: "error" }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "complete",
      "failed",
      "pending",
      "pending",
    ]);
    expect(summarizeSubmissionProgress(wizardInput({ currentStep: "submit", submissionStatus: "error" }))).toBe(
      "Failed at Submission",
    );
  });

  it("respects an explicit failedStage when submission errors", () => {
    const progress = getSubmissionStageProgress(
      wizardInput({
        currentStep: "submit",
        submissionStatus: "error",
        failedStage: "signing",
      }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "failed",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks submission complete after success and leaves later stages open", () => {
    const progress = getSubmissionStageProgress(
      wizardInput({ currentStep: "submit", submissionStatus: "success" }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "pending",
      "pending",
    ]);
  });
});

describe("run-driven progress", () => {
  it("starts at validation for a draft run", () => {
    expect(statesOf(getSubmissionStageProgress(runInput({})))).toEqual([
      "active",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks approval active while awaiting executive approval", () => {
    const progress = getSubmissionStageProgress(
      runInput({ approvalStatus: "pending_executive_approval" }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "active",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks approval failed when rejected (failure path)", () => {
    const progress = getSubmissionStageProgress(
      runInput({ approvalStatus: "rejected" }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "failed",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(summarizeSubmissionProgress(runInput({ approvalStatus: "rejected" }))).toBe(
      "Failed at Approval",
    );
  });

  it("marks signing active once approved", () => {
    const progress = getSubmissionStageProgress(
      runInput({ approvalStatus: "approved" }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "active",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks confirmation active when a pending run has a tx hash", () => {
    const progress = getSubmissionStageProgress(
      runInput({ approvalStatus: "approved", txHash: "0xabc" }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "active",
      "pending",
    ]);
  });

  it("marks all stages complete for a verified, reconciled run", () => {
    const progress = getSubmissionStageProgress(
      runInput({
        status: "verified",
        approvalStatus: "approved",
        reconciliationStatus: "complete",
        txHash: "0xabc",
      }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
    ]);
    expect(summarizeSubmissionProgress(runInput({ status: "verified", reconciliationStatus: "complete" }))).toBe(
      "All stages complete",
    );
  });

  it("marks reconciliation failed for a verified run with failed reconciliation (failure path)", () => {
    const progress = getSubmissionStageProgress(
      runInput({
        status: "verified",
        approvalStatus: "approved",
        reconciliationStatus: "failed",
      }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
      "failed",
    ]);
    expect(summarizeSubmissionProgress(runInput({ status: "verified", reconciliationStatus: "failed" }))).toBe(
      "Failed at Reconciliation",
    );
  });

  it("marks submission failed for a failed run (failure path)", () => {
    const progress = getSubmissionStageProgress(
      runInput({ status: "failed", approvalStatus: "approved" }),
    );
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "complete",
      "failed",
      "pending",
      "pending",
    ]);
  });
});

describe("cancelled runs map the cancellation reason to a stage", () => {
  it("skips validation for insufficient treasury", () => {
    const progress = getSubmissionStageProgress(
      runInput({
        status: "cancelled",
        cancellationReason: "treasury_insufficient",
      }),
    );
    expect(statesOf(progress)).toEqual([
      "skipped",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(summarizeSubmissionProgress(runInput({ status: "cancelled", cancellationReason: "treasury_insufficient" }))).toBe(
      "Cancelled at Validation",
    );
  });

  it("skips approval for approval rejection and compliance holds", () => {
    for (const reason of ["approval_rejected", "compliance_hold"] as const) {
      expect(cancelStageForReason(reason)).toBe("approval");
    }
  });

  it("skips validation for expired proofs and duplicate batches", () => {
    expect(cancelStageForReason("expired_proof")).toBe("validation");
    expect(cancelStageForReason("duplicate_batch")).toBe("validation");
  });

  it("defaults unknown and manual reasons to submission", () => {
    expect(cancelStageForReason("manual_request")).toBe("submission");
    expect(cancelStageForReason("unknown")).toBe("submission");
    expect(cancelStageForReason(undefined)).toBe("submission");
  });
});

describe("getStageState single-stage helper", () => {
  it("returns the same state as the full derivation", () => {
    const input = runInput({ approvalStatus: "approved", txHash: "0xabc" });
    expect(getStageState(input, "submission")).toBe("complete");
    expect(getStageState(input, "confirmation")).toBe("active");
    expect(getStageState(input, "reconciliation")).toBe("pending");
  });

  it("falls back to pending for unknown keys", () => {
    expect(getStageState(runInput({}), "signing")).toBe("pending");
  });
});

describe("event-driven progress", () => {
  it("returns all pending when no events exist", () => {
    const progress = getSubmissionStageProgressFromEvents([]);
    expect(statesOf(progress)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(summarizeSubmissionProgress(runInput({}))).not.toBe("Not started");
    expect(
      summarizeSubmissionProgress({ source: "run", run: baseRun as RunProgressInput["run"] }),
    ).toBeDefined();
  });

  it("marks a completed validation event stream", () => {
    const progress = getSubmissionStageProgressFromEvents([
      { stage: "validation", status: "started" },
      { stage: "validation", status: "succeeded" },
    ]);
    expect(statesOf(progress)).toEqual([
      "complete",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks a failed validation event stream (failure path)", () => {
    const progress = getSubmissionStageProgressFromEvents([
      { stage: "validation", status: "started" },
      { stage: "validation", status: "failed" },
    ]);
    expect(statesOf(progress)).toEqual([
      "failed",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("uses the latest event per stage and implies skipped stages (edge case)", () => {
    // The event stream has no approval stage (approvals live in the
    // approval-history store), so an active signing event implies approval
    // completed — gap stages between recorded events are filled as complete
    // rather than left misleadingly pending.
    const progress = getSubmissionStageProgressFromEvents([
      { stage: "validation", status: "failed" },
      { stage: "validation", status: "succeeded" },
      { stage: "wallet_signing", status: "started" },
    ]);
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "active",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("keeps stages failed even when later events exist (edge case)", () => {
    const progress = getSubmissionStageProgressFromEvents([
      { stage: "reconciliation", status: "failed" },
      { stage: "tx_submission", status: "succeeded" },
    ]);
    // Submission succeeded and reconciliation failed: the failed
    // reconciliation event itself implies confirmation completed (reconciliation
    // only runs after on-chain confirmation), so confirmation fills as complete.
    expect(statesOf(progress)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
      "failed",
    ]);
  });

  it("ignores unrelated event stages like onboarding", () => {
    const progress = getSubmissionStageProgressFromEvents([
      { stage: "employer_onboarding", status: "succeeded" },
    ]);
    expect(statesOf(progress)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });
});
