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
});
