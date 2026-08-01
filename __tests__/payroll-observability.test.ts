import { describe, it, expect, beforeEach } from "vitest";
import {
  generateCorrelationId,
  withCorrelationId,
  clearEventStore,
  getEventsByCorrelationId,
  generateIncidentTimeline,
} from "@/src/observability";
import {
  emitDraftCreated,
  emitValidationStarted,
  emitValidationSucceeded,
  emitProofSetupStarted,
  emitProofSetupSucceeded,
  emitPollingStarted,
  emitPollingSucceeded,
  emitPayrollRetry,
  emitReconciliationStarted,
  emitReconciliationSucceeded,
} from "@/src/payroll";
import {
  emitWalletSigningStarted,
  emitWalletSigningSucceeded,
  emitTxSubmissionStarted,
  emitTxSubmissionSucceeded,
} from "@/src/wallet";
import { emitPayrollFailure } from "@/src/errors";

describe("End-to-End Payroll Observability & Incident Replay Lifecycle", () => {
  beforeEach(() => {
    clearEventStore();
  });

  it("emits structured events across all 9 payroll lifecycle stages for a successful run", async () => {
    const runId = generateCorrelationId();

    await withCorrelationId(runId, async () => {
      emitDraftCreated({ payload: { employeeCount: 15, groupCount: 2 } });
      emitValidationStarted();
      emitValidationSucceeded({ payload: { isFunded: true } });
      emitProofSetupStarted({ payload: { proofType: "groth16" } });
      emitProofSetupSucceeded({ payload: { durationMs: 320 } });
      emitWalletSigningStarted({ payload: { network: "testnet" } });
      emitWalletSigningSucceeded("0xhash123");
      emitTxSubmissionStarted();
      emitTxSubmissionSucceeded("0xhash123");
      emitPollingStarted();
      emitPollingSucceeded();
      emitReconciliationStarted();
      emitReconciliationSucceeded();
    });

    const events = getEventsByCorrelationId(runId);
    expect(events.length).toBe(13);

    const stages = events.map((e) => e.stage);
    expect(stages).toContain("draft");
    expect(stages).toContain("validation");
    expect(stages).toContain("proof_setup");
    expect(stages).toContain("wallet_signing");
    expect(stages).toContain("tx_submission");
    expect(stages).toContain("polling");
    expect(stages).toContain("reconciliation");

    const timeline = generateIncidentTimeline(runId);
    expect(timeline.runStatus).toBe("succeeded");
    expect(timeline.hasFailures).toBe(false);
  });

  it("captures failure events and retry attempts correctly in timeline replay", async () => {
    const runId = generateCorrelationId();

    await withCorrelationId(runId, async () => {
      emitDraftCreated();
      emitWalletSigningStarted();
      emitPayrollFailure("wallet_signing", new Error("User declined to sign"), runId);
      emitPayrollRetry(1, 3);
      emitWalletSigningStarted();
      emitWalletSigningSucceeded("0xretryhash");
    });

    const events = getEventsByCorrelationId(runId);
    expect(events.length).toBe(6);

    const timeline = generateIncidentTimeline(runId);
    expect(timeline.hasFailures).toBe(true);

    const failedEntry = timeline.entries.find((e) => e.status === "failed");
    expect(failedEntry).toBeDefined();
    expect(failedEntry?.errorCategory).toBe("rejected");
    expect(failedEntry?.errorLabel).toBe("wallet_rejected");

    const retryEntry = timeline.entries.find((e) => e.stage === "retry");
    expect(retryEntry).toBeDefined();
    expect(retryEntry?.redactedContext.retryCount).toBe(1);
  });
});
