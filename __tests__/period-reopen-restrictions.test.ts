import { describe, expect, it } from "vitest";

import {
  assertPeriodReopenAllowed,
  canReopenPeriod,
  DEFAULT_PERIOD_REOPEN_POLICY,
  evaluatePeriodReopen,
  PERIOD_REOPEN_REFERENCE_NOW,
  PeriodReopenError,
  type PeriodCloseRecord,
  type PeriodReopenRequest,
} from "@/src/payroll/periodReopenRestrictions";

const NOW = PERIOD_REOPEN_REFERENCE_NOW;
const CLOSED_RECENTLY = "2026-01-01T00:00:00.000Z";

function makePeriod(
  overrides: Partial<PeriodCloseRecord> = {},
): PeriodCloseRecord {
  return {
    payrollRunId: "run-001",
    status: "closed",
    closedAt: CLOSED_RECENTLY,
    reopenedCount: 0,
    executedPayoutCount: 0,
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<PeriodReopenRequest> = {},
): PeriodReopenRequest {
  return {
    role: "operator",
    period: makePeriod(),
    reason: "Correction required for approved adjustments.",
    now: NOW,
    ...overrides,
  };
}

describe("evaluatePeriodReopen (#680)", () => {
  it("allows a privileged operator with a valid reason within the window", () => {
    const decision = evaluatePeriodReopen(makeRequest());

    expect(decision.allowed).toBe(true);
    expect(decision.role).toBe("operator");
    expect(decision.rejectionReason).toBeUndefined();
    expect(decision.auditLogged).toBe(true);
    expect(decision.reopenedCount).toBe(0);
    expect(decision.remainingReopenAttempts).toBe(2);
    expect(decision.message).toBe(
      "Reopen allowed: the period meets the reopen policy.",
    );
  });

  it("allows an admin to reopen a closed period", () => {
    const decision = evaluatePeriodReopen(makeRequest({ role: "admin" }));

    expect(decision.allowed).toBe(true);
    expect(decision.role).toBe("admin");
  });

  it("rejects unauthenticated requests with no personal data echoed", () => {
    const decision = evaluatePeriodReopen(
      makeRequest({ role: null, reason: "Sensitive employee details here." }),
    );

    expect(decision.allowed).toBe(false);
    expect(decision.role).toBe(null);
    expect(decision.rejectionReason).toBe("unauthenticated");
    expect(decision.message).toBe("Reopen denied: no authenticated operator.");
    expect(decision.auditLogged).toBe(true);
    expect(decision.message).not.toMatch(/employee/i);
  });

  it("rejects when the period is not closed or missing closedAt", () => {
    const open = evaluatePeriodReopen(
      makeRequest({ period: makePeriod({ status: "open" }) }),
    );
    expect(open.allowed).toBe(false);
    expect(open.rejectionReason).toBe("period_not_closed");

    const noClose = evaluatePeriodReopen(
      makeRequest({
        period: makePeriod({ status: "closed", closedAt: null }),
      }),
    );
    expect(noClose.allowed).toBe(false);
    expect(noClose.rejectionReason).toBe("period_not_closed");

    const missingClose = evaluatePeriodReopen(
      makeRequest({
        period: makePeriod({ status: "closed", closedAt: undefined }),
      }),
    );
    expect(missingClose.allowed).toBe(false);
    expect(missingClose.rejectionReason).toBe("period_not_closed");
  });

  it("rejects insufficient role (auditor cannot reopen)", () => {
    const decision = evaluatePeriodReopen(makeRequest({ role: "auditor" }));

    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("insufficient_role");
    expect(decision.message).toBe(
      "Reopen denied: your role cannot reopen payroll periods.",
    );
  });

  it("rejects reasons that are too short or too long", () => {
    const tooShort = evaluatePeriodReopen(makeRequest({ reason: "short" }));
    expect(tooShort.allowed).toBe(false);
    expect(tooShort.rejectionReason).toBe("reason_too_short");
    expect(tooShort.message).toBe(
      "Reopen denied: a longer justification is required.",
    );

    const longReason = "x".repeat(501);
    const tooLong = evaluatePeriodReopen(makeRequest({ reason: longReason }));
    expect(tooLong.allowed).toBe(false);
    expect(tooLong.rejectionReason).toBe("reason_too_long");
    expect(tooLong.message).toBe(
      "Reopen denied: the justification exceeds the allowed length.",
    );

    const trimmedShort = evaluatePeriodReopen(
      makeRequest({ reason: "          correction          " }),
    );
    expect(trimmedShort.allowed).toBe(true);
  });

  it("rejects when the reopen happens outside the maxDaysAfterClose window", () => {
    const decision = evaluatePeriodReopen(
      makeRequest({
        period: makePeriod({ closedAt: "2025-11-01T00:00:00.000Z" }),
        now: "2026-01-01T00:00:00.000Z",
      }),
    );

    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("reopen_window_expired");
    expect(decision.message).toBe(
      "Reopen denied: the period closed outside the reopen window.",
    );
  });

  it("rejects when the period has been reopened too many times", () => {
    const decision = evaluatePeriodReopen(
      makeRequest({
        period: makePeriod({ reopenedCount: 2 }),
      }),
    );

    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("reopen_limit_reached");
    expect(decision.remainingReopenAttempts).toBe(0);
    expect(decision.message).toBe(
      "Reopen denied: the period has been reopened too many times.",
    );
  });

  it("requires admin elevation when executed payouts exist and policy requires it", () => {
    const operatorNoElevation = evaluatePeriodReopen(
      makeRequest({
        role: "operator",
        period: makePeriod({ executedPayoutCount: 5 }),
        elevationApproved: false,
      }),
    );
    expect(operatorNoElevation.allowed).toBe(false);
    expect(operatorNoElevation.rejectionReason).toBe(
      "elevation_approval_required",
    );
    expect(operatorNoElevation.message).toBe(
      "Reopen denied: executed payouts require admin elevation.",
    );

    const operatorWithElevation = evaluatePeriodReopen(
      makeRequest({
        role: "operator",
        period: makePeriod({ executedPayoutCount: 5 }),
        elevationApproved: true,
      }),
    );
    expect(operatorWithElevation.allowed).toBe(true);
    expect(operatorWithElevation.message).toBe(
      "Reopen allowed: executed payouts recorded on this period.",
    );

    const adminWithPayouts = evaluatePeriodReopen(
      makeRequest({
        role: "admin",
        period: makePeriod({ executedPayoutCount: 5 }),
      }),
    );
    expect(adminWithPayouts.allowed).toBe(true);
  });

  it("uses a safe default for missing counts and is deterministic", () => {
    const decision = evaluatePeriodReopen(
      makeRequest({
        period: makePeriod({ reopenedCount: undefined, executedPayoutCount: undefined }),
      }),
    );

    expect(decision.allowed).toBe(true);
    expect(decision.reopenedCount).toBe(0);
    expect(decision.remainingReopenAttempts).toBe(2);

    const copy = makeRequest();
    const first = evaluatePeriodReopen(copy);
    const second = evaluatePeriodReopen(copy);
    expect(first).toEqual(second);
    expect(copy.reason).toBe("Correction required for approved adjustments.");
  });
});

describe("canReopenPeriod (#680)", () => {
  it("returns true when allowed and false when rejected", () => {
    expect(canReopenPeriod(makeRequest())).toBe(true);
    expect(canReopenPeriod(makeRequest({ role: null }))).toBe(false);
    expect(canReopenPeriod(makeRequest({ role: "auditor" }))).toBe(false);
  });
});

describe("assertPeriodReopenAllowed (#680)", () => {
  it("returns the decision when allowed", () => {
    const decision = assertPeriodReopenAllowed(makeRequest());

    expect(decision.allowed).toBe(true);
    expect(decision.rejectionReason).toBeUndefined();
  });

  it("throws PeriodReopenError with attached decision when rejected", () => {
    expect(() => assertPeriodReopenAllowed(makeRequest({ role: null }))).toThrow(
      PeriodReopenError,
    );

    try {
      assertPeriodReopenAllowed(makeRequest({ reason: "bad" }));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PeriodReopenError);
      const typed = error as PeriodReopenError;
      expect(typed.name).toBe("PeriodReopenError");
      expect(typed.decision.allowed).toBe(false);
      expect(typed.decision.rejectionReason).toBe("reason_too_short");
      expect(typed.decision.message).toBe(
        "Reopen denied: a longer justification is required.",
      );
      expect(typed.message).toBe(typed.decision.message);
    }
  });
});
