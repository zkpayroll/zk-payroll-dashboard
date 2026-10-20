import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  evaluateLateAdjustmentEscalation,
  requiresEscalatedReviewer,
  lateAdjustmentEscalationLabel,
  DEFAULT_EXECUTIVE_ESCALATION_THRESHOLD_HOURS,
  type LateAdjustmentWindowPolicy,
} from "@/lib/payroll/lateAdjustmentEscalation";
import LateAdjustmentEscalationBanner from "@/src/components/payroll/LateAdjustmentEscalationBanner";

// Late payroll adjustment escalation (#683).
//
// `lib/sdk/amendments.ts` already hard-blocks an amendment outside the
// commitment-window policy, but a late adjustment isn't always wrong to
// allow — it just needs more senior sign-off than an on-time one. This
// module decides *how much* more sign-off, based on how late the request
// landed relative to the policy's execution grace period.

const PERIOD_CLOSED_AT = "2026-08-01T00:00:00Z";
const GRACE_12H: LateAdjustmentWindowPolicy = { executionGracePeriodHours: 12 };

function hoursAfterClose(hours: number): string {
  return new Date(new Date(PERIOD_CLOSED_AT).getTime() + hours * 60 * 60 * 1000).toISOString();
}

describe("evaluateLateAdjustmentEscalation", () => {
  it("requires no escalation within the grace period (success path)", () => {
    const result = evaluateLateAdjustmentEscalation(PERIOD_CLOSED_AT, hoursAfterClose(5), GRACE_12H);
    expect(result.isLate).toBe(false);
    expect(result.escalationTier).toBe("none");
    expect(result.hoursLate).toBe(0);
  });

  it("treats exactly the grace period boundary as still on-time (edge case)", () => {
    const result = evaluateLateAdjustmentEscalation(PERIOD_CLOSED_AT, hoursAfterClose(12), GRACE_12H);
    expect(result.isLate).toBe(false);
  });

  it("requires senior review just past the grace period (failure path)", () => {
    const result = evaluateLateAdjustmentEscalation(PERIOD_CLOSED_AT, hoursAfterClose(13), GRACE_12H);
    expect(result.isLate).toBe(true);
    expect(result.escalationTier).toBe("senior_review");
    expect(result.hoursLate).toBeCloseTo(1, 1);
    expect(result.reason).toMatch(/senior reviewer/i);
  });

  it("requires executive review once past the executive escalation threshold (failure path)", () => {
    const requestedAt = hoursAfterClose(12 + DEFAULT_EXECUTIVE_ESCALATION_THRESHOLD_HOURS + 1);
    const result = evaluateLateAdjustmentEscalation(PERIOD_CLOSED_AT, requestedAt, GRACE_12H);
    expect(result.isLate).toBe(true);
    expect(result.escalationTier).toBe("executive_review");
    expect(result.reason).toMatch(/executive review/i);
  });

  it("respects a custom executive escalation threshold (edge case)", () => {
    // grace = 12h, executive threshold = 24h total since close, so the
    // executive boundary sits at 12h *past* grace (24 - 12).
    const policy: LateAdjustmentWindowPolicy = {
      executionGracePeriodHours: 12,
      executiveEscalationThresholdHours: 24,
    };
    const justUnderCustomThreshold = evaluateLateAdjustmentEscalation(
      PERIOD_CLOSED_AT,
      hoursAfterClose(23),
      policy,
    );
    expect(justUnderCustomThreshold.escalationTier).toBe("senior_review");

    const overCustomThreshold = evaluateLateAdjustmentEscalation(
      PERIOD_CLOSED_AT,
      hoursAfterClose(25),
      policy,
    );
    expect(overCustomThreshold.escalationTier).toBe("executive_review");
  });

  it("clamps a negative/zero grace period to zero rather than throwing (edge case)", () => {
    const result = evaluateLateAdjustmentEscalation(PERIOD_CLOSED_AT, hoursAfterClose(1), {
      executionGracePeriodHours: -5,
    });
    expect(result.isLate).toBe(true);
    expect(result.hoursLate).toBeGreaterThan(0);
  });

  it("treats invalid timestamps as zero elapsed time rather than throwing (failure path)", () => {
    expect(() =>
      evaluateLateAdjustmentEscalation("not-a-date", "also-not-a-date", GRACE_12H),
    ).not.toThrow();
    const result = evaluateLateAdjustmentEscalation("not-a-date", "also-not-a-date", GRACE_12H);
    expect(result.isLate).toBe(false);
  });
});

describe("requiresEscalatedReviewer", () => {
  it("is false only for the 'none' tier", () => {
    expect(requiresEscalatedReviewer("none")).toBe(false);
    expect(requiresEscalatedReviewer("senior_review")).toBe(true);
    expect(requiresEscalatedReviewer("executive_review")).toBe(true);
  });
});

describe("lateAdjustmentEscalationLabel", () => {
  it("has a human label for every tier", () => {
    expect(lateAdjustmentEscalationLabel("none")).toBe("Standard Review");
    expect(lateAdjustmentEscalationLabel("senior_review")).toBe("Senior Review Required");
    expect(lateAdjustmentEscalationLabel("executive_review")).toBe("Executive Review Required");
  });
});

describe("LateAdjustmentEscalationBanner", () => {
  it("renders nothing when the adjustment was on-time (quiet-by-default path)", () => {
    const { container } = render(
      <LateAdjustmentEscalationBanner
        periodClosedAt={PERIOD_CLOSED_AT}
        requestedAt={hoursAfterClose(5)}
        policy={GRACE_12H}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a senior-review banner for a moderately late adjustment (success path)", () => {
    render(
      <LateAdjustmentEscalationBanner
        periodClosedAt={PERIOD_CLOSED_AT}
        requestedAt={hoursAfterClose(13)}
        policy={GRACE_12H}
      />,
    );
    expect(screen.getByTestId("late-adjustment-escalation-banner")).toBeInTheDocument();
    expect(screen.getByTestId("late-adjustment-escalation-tier")).toHaveTextContent(
      "Senior Review Required",
    );
  });

  it("renders an executive-review banner for a severely late adjustment (edge case)", () => {
    render(
      <LateAdjustmentEscalationBanner
        periodClosedAt={PERIOD_CLOSED_AT}
        requestedAt={hoursAfterClose(12 + DEFAULT_EXECUTIVE_ESCALATION_THRESHOLD_HOURS + 1)}
        policy={GRACE_12H}
      />,
    );
    expect(screen.getByTestId("late-adjustment-escalation-tier")).toHaveTextContent(
      "Executive Review Required",
    );
  });
});
