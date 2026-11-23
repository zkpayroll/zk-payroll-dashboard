import { describe, it, expect, beforeEach } from "vitest";
import { usePeriodCloseStore } from "@/stores/periodClose";
import type { PeriodCloseInputs } from "@/lib/reconciliation/periodClose";

function makeInputs(overrides: Partial<PeriodCloseInputs> = {}): PeriodCloseInputs {
  return {
    payrollRunId: "tx_test",
    locks: [],
    disputes: [],
    reservations: [],
    exportedAuditTimelineRunIds: ["tx_test"],
    ...overrides,
  };
}

describe("usePeriodCloseStore", () => {
  beforeEach(() => {
    usePeriodCloseStore.setState({ closedPayrollRunIds: [] });
  });

  it("closes a period with no blockers", () => {
    const result = usePeriodCloseStore.getState().closePeriod(makeInputs());

    expect(result.success).toBe(true);
    expect(usePeriodCloseStore.getState().isClosed("tx_test")).toBe(true);
  });

  it("refuses to close a period with an unresolved blocker", () => {
    const result = usePeriodCloseStore.getState().closePeriod(
      makeInputs({
        locks: [
          {
            id: "lock_1",
            payrollId: "tx_test",
            reasonType: "manual_freeze",
            reasonDescription: "Frozen",
            lockedAt: "2025-01-01T00:00:00Z",
            lockedBy: "admin",
            resolutionAction: "Review",
            isResolved: false,
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
    expect(usePeriodCloseStore.getState().isClosed("tx_test")).toBe(false);
  });

  it("refuses to close a period that is already closed", () => {
    usePeriodCloseStore.getState().closePeriod(makeInputs());
    const result = usePeriodCloseStore.getState().closePeriod(makeInputs());

    expect(result.success).toBe(false);
    expect(result.error).toContain("already closed");
  });

  describe("reopenPeriod", () => {
    beforeEach(() => {
      usePeriodCloseStore.getState().closePeriod(makeInputs());
      expect(usePeriodCloseStore.getState().isClosed("tx_test")).toBe(true);
    });

    it("reopens a closed period with a valid reason", () => {
      const result = usePeriodCloseStore.getState().reopenPeriod({
        payrollRunId: "tx_test",
        reason: "Missing employee adjustment discovered during post-close review.",
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(usePeriodCloseStore.getState().isClosed("tx_test")).toBe(false);
    });

    it("refuses to reopen a period that is not closed", () => {
      usePeriodCloseStore.setState({ closedPayrollRunIds: [] });

      const result = usePeriodCloseStore.getState().reopenPeriod({
        payrollRunId: "tx_test",
        reason: "Valid reopen reason with enough characters.",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not currently closed");
    });

    it("refuses to reopen with a reason shorter than 10 characters", () => {
      const result = usePeriodCloseStore.getState().reopenPeriod({
        payrollRunId: "tx_test",
        reason: "short",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 10 characters");
      expect(usePeriodCloseStore.getState().isClosed("tx_test")).toBe(true);
    });

    it("refuses to reopen with a reason longer than 500 characters", () => {
      const longReason = "a".repeat(501);
      const result = usePeriodCloseStore.getState().reopenPeriod({
        payrollRunId: "tx_test",
        reason: longReason,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("500 characters or fewer");
      expect(usePeriodCloseStore.getState().isClosed("tx_test")).toBe(true);
    });

    it("trims whitespace before validating reason length", () => {
      const result = usePeriodCloseStore.getState().reopenPeriod({
        payrollRunId: "tx_test",
        reason: "   short   ",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 10 characters");
    });

    it("allows a 500-character reason exactly", () => {
      const exactReason = "a".repeat(500);
      const result = usePeriodCloseStore.getState().reopenPeriod({
        payrollRunId: "tx_test",
        reason: exactReason,
      });

      expect(result.success).toBe(true);
      expect(usePeriodCloseStore.getState().isClosed("tx_test")).toBe(false);
    });
  });
});
