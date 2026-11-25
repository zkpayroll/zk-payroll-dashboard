import { describe, it, expect } from "vitest";
import {
  collapseFinalizationDuplicates,
  isFinalizationAction,
} from "@/components/features/payroll/PayrollActivityTimeline";
import type {
  PayrollApprovalActionType,
  PayrollApprovalEvent,
} from "@/stores/payrollAuditTrail";

function ev(
  id: string,
  action: PayrollApprovalActionType,
  payrollRunId = "run-1",
  timestamp = "2026-11-25T10:00:00Z",
): PayrollApprovalEvent {
  return {
    id,
    payrollRunId,
    action,
    actor: "op",
    timestamp,
  };
}

/**
 * #793 — Repeated finalization events (webhook retries, double-submits) must
 * collapse into a single row with a count so the timeline stays scannable.
 */
describe("Issue #793 — finalization repeat collapsing", () => {
  it("names only the terminal actions as finalization", () => {
    expect(isFinalizationAction("submitted")).toBe(true);
    expect(isFinalizationAction("period_locked")).toBe(true);
    // Non-finalization lifecycle events pass through untouched.
    expect(isFinalizationAction("draft_created")).toBe(false);
    expect(isFinalizationAction("review_initiated")).toBe(false);
    expect(isFinalizationAction("proof_failed")).toBe(false);
  });

  it("collapses adjacent same-action finalization events for the same run", () => {
    const collapsed = collapseFinalizationDuplicates([
      ev("a", "draft_created", "run-1", "2026-11-25T10:00:00Z"),
      ev("b", "submitted", "run-1", "2026-11-25T10:01:00Z"),
      ev("c", "submitted", "run-1", "2026-11-25T10:01:02Z"),
      ev("d", "submitted", "run-1", "2026-11-25T10:01:05Z"),
    ]);
    expect(collapsed).toHaveLength(2);
    expect(collapsed[0].anchor.id).toBe("a");
    expect(collapsed[0].repeated).toHaveLength(0);
    expect(collapsed[1].anchor.id).toBe("b");
    expect(collapsed[1].repeated.map((e) => e.id)).toEqual(["c", "d"]);
  });

  it("does not collapse across different runs (rejection)", () => {
    const collapsed = collapseFinalizationDuplicates([
      ev("a", "submitted", "run-1", "2026-11-25T10:00:00Z"),
      ev("b", "submitted", "run-2", "2026-11-25T10:00:01Z"),
    ]);
    expect(collapsed).toHaveLength(2);
    expect(collapsed.every((c) => c.repeated.length === 0)).toBe(true);
  });

  it("does not collapse across different finalization actions (boundary)", () => {
    const collapsed = collapseFinalizationDuplicates([
      ev("a", "submitted", "run-1"),
      ev("b", "period_locked", "run-1"),
    ]);
    expect(collapsed).toHaveLength(2);
    expect(collapsed[0].repeated).toHaveLength(0);
    expect(collapsed[1].repeated).toHaveLength(0);
  });

  it("leaves non-finalization lifecycle events untouched", () => {
    const collapsed = collapseFinalizationDuplicates([
      ev("a", "proof_generated", "run-1", "2026-11-25T10:00:00Z"),
      ev("b", "proof_generated", "run-1", "2026-11-25T10:00:01Z"),
    ]);
    // Only the finalization actions above are collapsed; proof_generated
    // rows remain individual entries so the operator can see retries.
    expect(collapsed).toHaveLength(2);
    expect(collapsed.every((c) => c.repeated.length === 0)).toBe(true);
  });
});
