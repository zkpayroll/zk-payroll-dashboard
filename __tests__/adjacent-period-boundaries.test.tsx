import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  explainAdjacentPeriodBoundaries,
  resolveEventPeriod,
  type PayrollPeriodBoundary,
} from "@/lib/audit/adjacentPeriodBoundaries";
import { AdjacentPeriodBoundariesCard } from "@/components/features/audit/AdjacentPeriodBoundariesCard";

describe("Adjacent Payroll Period Boundaries in Audit Grants (#837)", () => {
  const periodA: PayrollPeriodBoundary = {
    periodId: "period_2026_09",
    periodLabel: "September 2026",
    startUtc: "2026-09-01T00:00:00.000Z",
    endUtc: "2026-10-01T00:00:00.000Z",
  };

  const periodB: PayrollPeriodBoundary = {
    periodId: "period_2026_10",
    periodLabel: "October 2026",
    startUtc: "2026-10-01T00:00:00.000Z",
    endUtc: "2026-11-01T00:00:00.000Z",
  };

  it("identifies continuous adjacent periods with exact boundary timestamp", () => {
    const result = explainAdjacentPeriodBoundaries(periodA, periodB);

    expect(result.valid).toBe(true);
    expect(result.relationship).toBe("continuous");
    expect(result.boundaryTimestamp).toBe("2026-10-01T00:00:00.000Z");
    expect(result.gapMs).toBe(0);
    expect(result.overlapMs).toBe(0);
    expect(result.periodAInterval).toBe("[2026-09-01T00:00:00.000Z, 2026-10-01T00:00:00.000Z)");
    expect(result.periodBInterval).toBe("[2026-10-01T00:00:00.000Z, 2026-11-01T00:00:00.000Z)");
    expect(result.boundaryResolution).toContain("belong exclusively to succeeding period 'October 2026'");
  });

  it("assigns event occurring exactly at the boundary to succeeding Period B", () => {
    const boundaryTime = "2026-10-01T00:00:00.000Z";
    const resolution = resolveEventPeriod(boundaryTime, periodA, periodB);

    expect(resolution.assignedPeriodId).toBe("period_2026_10");
    expect(resolution.isBoundaryCollision).toBe(true);
    expect(resolution.explanation).toContain("assigned to succeeding period 'October 2026'");
  });

  it("assigns events strictly inside Period A or Period B correctly", () => {
    const timeInA = "2026-09-15T12:00:00.000Z";
    const resA = resolveEventPeriod(timeInA, periodA, periodB);
    expect(resA.assignedPeriodId).toBe("period_2026_09");
    expect(resA.isBoundaryCollision).toBe(false);

    const timeInB = "2026-10-15T12:00:00.000Z";
    const resB = resolveEventPeriod(timeInB, periodA, periodB);
    expect(resB.assignedPeriodId).toBe("period_2026_10");
    expect(resB.isBoundaryCollision).toBe(false);
  });

  it("detects and flags overlapping periods with overlap duration", () => {
    const overlappingB: PayrollPeriodBoundary = {
      periodId: "period_2026_10_overlap",
      periodLabel: "October Overlapping",
      startUtc: "2026-09-28T00:00:00.000Z", // 3 days overlap with Period A
      endUtc: "2026-10-28T00:00:00.000Z",
    };

    const result = explainAdjacentPeriodBoundaries(periodA, overlappingB);

    expect(result.valid).toBe(false);
    expect(result.relationship).toBe("overlap");
    expect(result.overlapMs).toBe(3 * 24 * 60 * 60 * 1000);
    expect(result.summary).toContain("overlap by 72.0 hours");
    expect(result.error).toContain("Boundary overlap");
  });

  it("detects and flags uncovered temporal gaps between periods", () => {
    const gappedB: PayrollPeriodBoundary = {
      periodId: "period_2026_10_gap",
      periodLabel: "October Gapped",
      startUtc: "2026-10-03T00:00:00.000Z", // 2 days gap after Period A
      endUtc: "2026-11-01T00:00:00.000Z",
    };

    const result = explainAdjacentPeriodBoundaries(periodA, gappedB);

    expect(result.valid).toBe(false);
    expect(result.relationship).toBe("gap");
    expect(result.gapMs).toBe(2 * 24 * 60 * 60 * 1000);
    expect(result.summary).toContain("gap of 48.0 hours");
    expect(result.boundaryResolution).toContain("fall outside both audit periods");
  });

  it("handles reversed periods and invalid timestamps safely without crashing", () => {
    const reversedResult = explainAdjacentPeriodBoundaries(periodB, periodA);
    expect(reversedResult.valid).toBe(false);
    expect(reversedResult.relationship).toBe("reversed");
    expect(reversedResult.error).toContain("Chronological inversion");

    const invalidResult = explainAdjacentPeriodBoundaries(
      { ...periodA, startUtc: "invalid-date" },
      periodB
    );
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.relationship).toBe("invalid");
    expect(invalidResult.error).toContain("One or more period boundary dates could not be parsed");
  });

  it("asserts zero-knowledge privacy guarantee is present in explanations", () => {
    const result = explainAdjacentPeriodBoundaries(periodA, periodB);
    expect(result.privacyGuarantee).toContain("Zero-knowledge privacy guarantee");
    expect(result.privacyGuarantee).toContain("employee salaries, balances, and recipient wallets remain cryptographically sealed");
  });

  it("renders AdjacentPeriodBoundariesCard UI with correct data-testids", () => {
    render(<AdjacentPeriodBoundariesCard periodA={periodA} periodB={periodB} />);

    expect(screen.getByTestId("audit-adjacent-period-boundaries")).toBeInTheDocument();
    expect(screen.getByTestId("boundary-status-badge")).toHaveTextContent("Continuous Boundaries");
    expect(screen.getByTestId("interval-a")).toHaveTextContent("[2026-09-01T00:00:00.000Z, 2026-10-01T00:00:00.000Z)");
    expect(screen.getByTestId("interval-b")).toHaveTextContent("[2026-10-01T00:00:00.000Z, 2026-11-01T00:00:00.000Z)");
    expect(screen.getByTestId("boundary-summary")).toBeInTheDocument();
    expect(screen.getByTestId("boundary-resolution")).toBeInTheDocument();
    expect(screen.getByTestId("boundary-privacy-guarantee")).toBeInTheDocument();
  });
});
