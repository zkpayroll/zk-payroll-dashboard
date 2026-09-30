import { describe, expect, it } from "vitest";
import {
  checkPayrollStateConsistency,
  getConsistencyGuardMessage,
  type PayrollStateSnapshot,
} from "@/lib/payroll/stateConsistency";

const baseSnapshot: PayrollStateSnapshot = {
  wizardStep: "review",
  wizardEmployeeIds: ["emp-001", "emp-002"],
  wizardTotalAmount: 10000,
  proofStatus: "idle",
  submissionStatus: "idle",
  transactionHash: null,
  runId: "run-001",
  progressRunId: "run-001",
  progressStep: "review",
  progressEmployeeCount: 2,
  progressProofReady: false,
  progressSubmitted: false,
  progressUpdatedAt: "2025-01-15T12:00:00Z",
  hasActiveDraft: true,
  draftEmployeeIds: ["emp-001", "emp-002"],
  now: "2025-01-15T12:05:00Z",
};

describe("checkPayrollStateConsistency", () => {
  it("returns consistent for a clean snapshot", () => {
    const result = checkPayrollStateConsistency(baseSnapshot);

    expect(result.isConsistent).toBe(true);
    expect(result.inconsistencies).toHaveLength(0);
  });

  it("detects orphaned progress from a different run", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      progressRunId: "run-old-999",
    };

    const result = checkPayrollStateConsistency(snapshot);

    expect(result.isConsistent).toBe(false);
    expect(result.inconsistencies).toHaveLength(1);
    expect(result.inconsistencies[0].type).toBe("orphaned_progress");
    expect(result.inconsistencies[0].severity).toBe("warning");
    expect(result.inconsistencies[0].affectedRunId).toBe("run-old-999");
  });

  it("detects stale progress that was never submitted", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      runId: null,
      progressRunId: "run-stale-001",
      progressSubmitted: false,
      progressUpdatedAt: "2025-01-15T11:00:00Z",
      now: "2025-01-15T12:00:00Z",
    };

    const result = checkPayrollStateConsistency(snapshot);

    expect(result.isConsistent).toBe(false);
    expect(result.inconsistencies.some((i) => i.type === "stale_progress")).toBe(true);
  });

  it("does not flag stale progress for recently updated runs", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      runId: null,
      progressRunId: "run-recent-001",
      progressSubmitted: false,
      progressUpdatedAt: "2025-01-15T11:50:00Z",
      now: "2025-01-15T12:00:00Z",
    };

    const result = checkPayrollStateConsistency(snapshot);

    expect(result.isConsistent).toBe(true);
  });

  it("detects wizard step regression", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      wizardStep: "review",
      progressStep: "submit",
    };

    const result = checkPayrollStateConsistency(snapshot);

    expect(result.isConsistent).toBe(false);
    const conflict = result.inconsistencies.find(
      (i) => i.type === "wizard_draft_conflict",
    );
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe("critical");
  });

  it("does not flag step regression when wizard is ahead of progress", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      wizardStep: "submit",
      progressStep: "review",
    };

    const result = checkPayrollStateConsistency(snapshot);

    expect(result.isConsistent).toBe(true);
  });

  it("detects proof ready but submission not started", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      proofStatus: "success",
      submissionStatus: "idle",
      wizardStep: "submit",
      transactionHash: null,
    };

    const result = checkPayrollStateConsistency(snapshot);

    expect(result.isConsistent).toBe(false);
    const mismatch = result.inconsistencies.find(
      (i) => i.type === "proof_submission_mismatch",
    );
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe("warning");
  });

  it("detects employee count mismatch", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      wizardEmployeeIds: ["emp-001", "emp-002", "emp-003"],
      progressEmployeeCount: 2,
    };

    const result = checkPayrollStateConsistency(snapshot);

    expect(result.isConsistent).toBe(false);
    const mismatch = result.inconsistencies.find(
      (i) => i.type === "employee_count_mismatch",
    );
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe("critical");
  });

  it("returns multiple inconsistencies when multiple issues exist", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      progressRunId: "run-orphan-001",
      wizardEmployeeIds: ["emp-001"],
      progressEmployeeCount: 5,
    };

    const result = checkPayrollStateConsistency(snapshot);

    expect(result.isConsistent).toBe(false);
    expect(result.inconsistencies.length).toBeGreaterThanOrEqual(2);
  });
});

describe("getConsistencyGuardMessage", () => {
  it("returns null when state is consistent", () => {
    const result = checkPayrollStateConsistency(baseSnapshot);
    expect(getConsistencyGuardMessage(result)).toBeNull();
  });

  it("returns critical message when a critical inconsistency exists", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      wizardStep: "review",
      progressStep: "submit",
    };
    const result = checkPayrollStateConsistency(snapshot);
    const message = getConsistencyGuardMessage(result);

    expect(message).not.toBeNull();
    expect(message).toMatch(/wizard step regression/i);
  });

  it("returns warning message when only warnings exist", () => {
    const snapshot: PayrollStateSnapshot = {
      ...baseSnapshot,
      progressRunId: "run-orphan-001",
    };
    const result = checkPayrollStateConsistency(snapshot);
    const message = getConsistencyGuardMessage(result);

    expect(message).not.toBeNull();
    expect(message).toMatch(/warning/i);
  });
});
