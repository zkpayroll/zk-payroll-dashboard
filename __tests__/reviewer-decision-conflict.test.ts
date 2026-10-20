import { describe, expect, it, beforeEach } from "vitest";
import {
  createConflictRecord,
  resolveConflict,
  escalateConflict,
  evaluateConflict,
  type ConflictRecord,
  type ReviewerDecision,
} from "@/payroll/reviewerDecisionConflictDetection";

const NOW = Date.now();

describe("Reviewer Decision Conflict Detection", () => {
  let decisions: ReviewerDecision[];
  let conflict: ConflictRecord;

  beforeEach(() => {
    decisions = [
      { id: "dec_1", reviewerId: "rev_1", operationRef: "op_123", decision: "approve", decisionAt: NOW },
      { id: "dec_2", reviewerId: "rev_2", operationRef: "op_123", decision: "approve", decisionAt: NOW + 1000 },
    ];

    conflict = createConflictRecord({
      id: "conflict_1",
      operationRef: "op_123",
      decisions,
      now: NOW,
    });
  });

  it("creates a conflict record for unanimous decisions", () => {
    expect(conflict.id).toBe("conflict_1");
    expect(conflict.status).toBe("no_conflict");
    expect(conflict.decisions.length).toBe(2);
  });

  it("detects approve-reject mismatch", () => {
    const mixedDecisions: ReviewerDecision[] = [
      { id: "dec_1", reviewerId: "rev_1", operationRef: "op_123", decision: "approve", decisionAt: NOW },
      { id: "dec_2", reviewerId: "rev_2", operationRef: "op_123", decision: "reject", decisionAt: NOW + 1000 },
    ];

    const conflictRecord = createConflictRecord({
      id: "conflict_2",
      operationRef: "op_123",
      decisions: mixedDecisions,
    });

    expect(conflictRecord.status).toBe("conflict_detected");
    expect(conflictRecord.conflictType).toBe("approve_reject_mismatch");
  });

  it("detects multiple rejections", () => {
    const rejectDecisions: ReviewerDecision[] = [
      { id: "dec_1", reviewerId: "rev_1", operationRef: "op_123", decision: "reject", decisionAt: NOW },
      { id: "dec_2", reviewerId: "rev_2", operationRef: "op_123", decision: "reject", decisionAt: NOW + 1000 },
    ];

    const conflictRecord = createConflictRecord({
      id: "conflict_3",
      operationRef: "op_123",
      decisions: rejectDecisions,
    });

    expect(conflictRecord.status).toBe("conflict_detected");
    expect(conflictRecord.conflictType).toBe("multiple_rejections");
  });

  it("resolves a conflict with a resolution method", () => {
    const conflictRecord = createConflictRecord({
      id: "conflict_4",
      operationRef: "op_124",
      decisions: [
        { id: "dec_1", reviewerId: "rev_1", operationRef: "op_124", decision: "approve", decisionAt: NOW },
        { id: "dec_2", reviewerId: "rev_2", operationRef: "op_124", decision: "reject", decisionAt: NOW + 1000 },
      ],
    });

    const resolved = resolveConflict(conflictRecord, "consensus_review", "op_senior");
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolutionMethod).toBe("consensus_review");
    expect(resolved.resolutionApprovedBy).toBe("op_senior");
    expect(resolved.resolvedAt).toBeDefined();
  });

  it("escalates a conflict for senior review", () => {
    const escalated = escalateConflict(conflict, "Requires senior operator decision");
    expect(escalated.status).toBe("escalated");
    expect(escalated.resolvedAt).toBeDefined();
  });

  it("prevents resolving already resolved conflicts", () => {
    const resolved = resolveConflict(conflict, "consensus_review", "op_senior");
    expect(() => resolveConflict(resolved, "senior_operator_override", "op_other")).toThrow("already resolved");
  });

  it("evaluates conflict record correctly", () => {
    const evaluation = evaluateConflict(conflict);
    expect(evaluation.hasConflict).toBe(false);
    expect(evaluation.status).toBe("no_conflict");
    expect(evaluation.approveCount).toBe(2);
    expect(evaluation.rejectCount).toBe(0);
    expect(evaluation.resolutionRequired).toBe(false);
  });

  it("suggests resolution method based on decision distribution", () => {
    const conflictRecord = createConflictRecord({
      id: "conflict_5",
      operationRef: "op_125",
      decisions: [
        { id: "dec_1", reviewerId: "rev_1", operationRef: "op_125", decision: "reject", decisionAt: NOW },
        { id: "dec_2", reviewerId: "rev_2", operationRef: "op_125", decision: "reject", decisionAt: NOW + 1000 },
        { id: "dec_3", reviewerId: "rev_3", operationRef: "op_125", decision: "approve", decisionAt: NOW + 2000 },
      ],
    });

    const evaluation = evaluateConflict(conflictRecord);
    expect(evaluation.hasConflict).toBe(true);
    expect(evaluation.rejectCount).toBe(2);
    expect(evaluation.approveCount).toBe(1);
  });

  it("validates required fields during creation", () => {
    expect(() =>
      createConflictRecord({
        id: "",
        operationRef: "op_123",
        decisions: [{ id: "dec_1", reviewerId: "rev_1", operationRef: "op_123", decision: "approve", decisionAt: NOW }],
      }),
    ).toThrow("id must be provided");

    expect(() =>
      createConflictRecord({
        id: "conf_1",
        operationRef: "op_123",
        decisions: [],
      }),
    ).toThrow("At least one reviewer decision");
  });
});
