import { describe, it, expect } from "vitest";
import { buildPeriodCloseChecklist } from "@/lib/reconciliation/periodClose";
import type { PayrollLock, PayrollDispute, FundingReservation } from "@/types/models";

function makeLock(overrides: Partial<PayrollLock> = {}): PayrollLock {
  return {
    id: "lock_x",
    payrollId: "tx_x",
    reasonType: "manual_freeze",
    reasonDescription: "Manual freeze",
    lockedAt: "2025-01-01T00:00:00Z",
    lockedBy: "admin",
    resolutionAction: "Review",
    isResolved: false,
    ...overrides,
  };
}

function makeDispute(overrides: Partial<PayrollDispute> = {}): PayrollDispute {
  return {
    id: "dsp_x",
    payrollPeriod: "2025-01",
    payrollBatch: "batch_x",
    payrollRunId: "tx_x",
    raisedBy: "emp_x",
    reason: "Disputed amount",
    isResolved: false,
    status: "active",
    resolutionDeadline: "2025-01-31T23:59:59Z",
    safeReasonCode: "employee_data_changed",
    safeReasonDescription: "Disputed amount",
    blockedActions: ["execution"],
    requiredReviewer: "admin",
    resolutionAction: "Review",
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeReservation(overrides: Partial<FundingReservation> = {}): FundingReservation {
  return {
    id: "rsv_x",
    payrollRunId: "tx_x",
    amount: 100,
    purpose: "Reserved funds",
    isReleased: false,
    ...overrides,
  };
}

describe("buildPeriodCloseChecklist", () => {
  it("allows closing when all four categories are clear", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_clean",
      locks: [],
      disputes: [],
      reservations: [],
      exportedAuditTimelineRunIds: ["tx_clean"],
    });

    expect(checklist.canClose).toBe(true);
    expect(checklist.items.every((i) => i.isSatisfied)).toBe(true);
  });

  it("blocks closing when there is an unresolved hold", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_x",
      locks: [makeLock({ isResolved: false })],
      disputes: [],
      reservations: [],
      exportedAuditTimelineRunIds: ["tx_x"],
    });

    expect(checklist.canClose).toBe(false);
    const holdsItem = checklist.items.find((i) => i.category === "holds")!;
    expect(holdsItem.isSatisfied).toBe(false);
    expect(holdsItem.blockers).toHaveLength(1);
  });

  it("does not block on a resolved hold", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_x",
      locks: [makeLock({ isResolved: true })],
      disputes: [],
      reservations: [],
      exportedAuditTimelineRunIds: ["tx_x"],
    });

    const holdsItem = checklist.items.find((i) => i.category === "holds")!;
    expect(holdsItem.isSatisfied).toBe(true);
  });

  it("blocks closing when there is an unresolved dispute", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_x",
      locks: [],
      disputes: [makeDispute({ isResolved: false })],
      reservations: [],
      exportedAuditTimelineRunIds: ["tx_x"],
    });

    expect(checklist.canClose).toBe(false);
    expect(checklist.items.find((i) => i.category === "disputes")!.isSatisfied).toBe(false);
  });

  it("blocks closing when there is an unreleased funding reservation", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_x",
      locks: [],
      disputes: [],
      reservations: [makeReservation({ isReleased: false })],
      exportedAuditTimelineRunIds: ["tx_x"],
    });

    expect(checklist.canClose).toBe(false);
    expect(checklist.items.find((i) => i.category === "funding_reservations")!.isSatisfied).toBe(false);
  });

  it("blocks closing when there is no exported audit reference", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_x",
      locks: [],
      disputes: [],
      reservations: [],
      exportedAuditTimelineRunIds: [], // tx_x not present
    });

    expect(checklist.canClose).toBe(false);
    const auditItem = checklist.items.find((i) => i.category === "audit_references")!;
    expect(auditItem.isSatisfied).toBe(false);
    expect(auditItem.blockers).toHaveLength(1);
  });

  it("only considers entries for the requested payroll run", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_x",
      locks: [makeLock({ payrollId: "tx_other", isResolved: false })],
      disputes: [makeDispute({ payrollRunId: "tx_other", isResolved: false })],
      reservations: [makeReservation({ payrollRunId: "tx_other", isReleased: false })],
      exportedAuditTimelineRunIds: ["tx_x"],
    });

    expect(checklist.canClose).toBe(true);
  });

  it("reports all blockers when multiple categories fail simultaneously", () => {
    const checklist = buildPeriodCloseChecklist({
      payrollRunId: "tx_x",
      locks: [makeLock({ isResolved: false })],
      disputes: [makeDispute({ isResolved: false })],
      reservations: [makeReservation({ isReleased: false })],
      exportedAuditTimelineRunIds: [],
    });

    expect(checklist.canClose).toBe(false);
    expect(checklist.items.filter((i) => !i.isSatisfied)).toHaveLength(4);
  });
});
