import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
  PayrollImportRollbackError,
  assertPayrollImportRollbackAllowed,
  evaluatePayrollImportRollback,
} from "@/src/payroll/payrollImportRollback";

const now = () => Date.now();

describe("evaluatePayrollImportRollback", () => {
  const completedBatch = {
    id: "import_001",
    importedAt: new Date(now() - 2 * 60 * 60 * 1000).toISOString(),
    recordCount: 10,
    status: "completed" as const,
  };

  it("allows rollback of a completed batch within the window", () => {
    const evaluation = evaluatePayrollImportRollback(
      completedBatch,
      DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
      now(),
    );

    expect(evaluation.allowed).toBe(true);
    expect(evaluation.canRollback).toBe(true);
    expect(evaluation.decision.reason).toBeUndefined();
    expect(evaluation.decision.message).toContain("eligible for rollback");
    expect(evaluation.decision.remainingWindowHours).toBeGreaterThan(0);
  });

  it("blocks rollback of a batch that is not completed", () => {
    const evaluation = evaluatePayrollImportRollback(
      { ...completedBatch, status: "pending" },
      DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
      now(),
    );

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.decision.reason).toBe("batch_not_completed");
    expect(evaluation.decision.message).toContain("not in a completed state");
  });

  it("blocks rollback once the window expires", () => {
    const oldBatch = {
      ...completedBatch,
      importedAt: new Date(now() - 30 * 60 * 60 * 1000).toISOString(),
    };
    const evaluation = evaluatePayrollImportRollback(
      oldBatch,
      DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
      now(),
    );

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.decision.reason).toBe("rollback_window_expired");
    expect(evaluation.decision.message).toContain("beyond the 24-hour rollback window");
  });

  it("blocks rollback after on-chain execution unless policy allows", () => {
    const executedBatch = {
      ...completedBatch,
      snapshotId: "snap_001",
    };
    const evaluation = evaluatePayrollImportRollback(
      executedBatch,
      DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
      now(),
    );

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.decision.reason).toBe("executed_on_chain");
  });

  it("allows rollback after execution when policy permits", () => {
    const executedBatch = {
      ...completedBatch,
      snapshotId: "snap_001",
    };
    const policy = {
      ...DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
      allowRollbackAfterExecution: true,
    };
    const evaluation = evaluatePayrollImportRollback(executedBatch, policy, now());

    expect(evaluation.allowed).toBe(true);
  });

  it("handles a malformed batch gracefully", () => {
    const evaluation = evaluatePayrollImportRollback(
      null,
      DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
      now(),
    );

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.decision.reason).toBe("unknown_batch");
  });

  it("uses a custom max rollback age", () => {
    const recentBatch = {
      ...completedBatch,
      importedAt: new Date(now() - 10 * 60 * 60 * 1000).toISOString(),
    };
    const policy = {
      ...DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
      maxRollbackAgeHours: 5,
    };
    const evaluation = evaluatePayrollImportRollback(recentBatch, policy, now());

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.decision.reason).toBe("rollback_window_expired");
  });
});

describe("DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY", () => {
  it("has a 24-hour window and disallows post-execution rollback", () => {
    expect(DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY.maxRollbackAgeHours).toBe(24);
    expect(DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY.allowRollbackAfterExecution).toBe(false);
    expect(DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY.allowRollbackAfterReconciliation).toBe(false);
  });
});

describe("assertPayrollImportRollbackAllowed", () => {
  const completedBatch = {
    id: "import_002",
    importedAt: new Date(now() - 1 * 60 * 60 * 1000).toISOString(),
    recordCount: 5,
    status: "completed" as const,
  };

  it("returns the evaluation when rollback is allowed", () => {
    const evaluation = assertPayrollImportRollbackAllowed(
      completedBatch,
      DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
      now(),
    );

    expect(evaluation.allowed).toBe(true);
  });

  it("throws a typed error carrying the evaluation when not allowed", () => {
    let thrown: unknown;
    try {
      assertPayrollImportRollbackAllowed(
        { ...completedBatch, status: "failed" },
        DEFAULT_PAYROLL_IMPORT_ROLLBACK_POLICY,
        now(),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PayrollImportRollbackError);
    const error = thrown as PayrollImportRollbackError;
    expect(error.name).toBe("PayrollImportRollbackError");
    expect(error.evaluation.decision.reason).toBe("batch_not_completed");
    expect(error.message).toContain("not in a completed state");
  });
});