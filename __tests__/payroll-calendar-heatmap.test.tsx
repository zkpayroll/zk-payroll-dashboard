import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollCalendar from "@/components/features/payroll/PayrollCalendar";
import { classifyRun, getDominantRunKind, getHeatmapIntensity } from "@/lib/payroll/scheduleUtils";
import type { PayrollRun } from "@/types/models";

function makeRun(overrides: Partial<PayrollRun>): PayrollRun {
  return {
    id: "run_test",
    companyId: "company_001",
    timestamp: "2025-06-15T09:00:00Z",
    createdAt: "2025-06-15T09:00:00Z",
    totalAmount: 1000,
    employeeCount: 1,
    proof: "0xproof",
    status: "pending",
    employeeIds: ["emp_001"],
    executedAt: null,
    transactionHash: null,
    ...overrides,
  };
}

describe("scheduleUtils heatmap classification", () => {
  it("classifies failed runs as failed regardless of approval status", () => {
    const run = makeRun({ status: "failed", approvalStatus: "pending_executive_approval" });
    expect(classifyRun(run)).toBe("failed");
  });

  it("classifies verified runs as completed", () => {
    const run = makeRun({ status: "verified" });
    expect(classifyRun(run)).toBe("completed");
  });

  it("classifies pending runs awaiting executive review as pending_approval", () => {
    const run = makeRun({ status: "pending", approvalStatus: "pending_executive_approval" });
    expect(classifyRun(run)).toBe("pending_approval");
  });

  it("falls back to scheduled for plain pending runs", () => {
    const run = makeRun({ status: "pending" });
    expect(classifyRun(run)).toBe("scheduled");
  });

  it("returns zero intensity for an empty day", () => {
    expect(getHeatmapIntensity([])).toBe(0);
  });

  it("weighs failed and pending-approval runs more heavily than routine runs", () => {
    const failedDay = [makeRun({ status: "failed" })];
    const scheduledDay = [makeRun({ status: "pending" })];
    expect(getHeatmapIntensity(failedDay)).toBeGreaterThan(getHeatmapIntensity(scheduledDay));
  });

  it("caps intensity at 4 for very busy days", () => {
    const busyDay = Array.from({ length: 10 }, (_, i) => makeRun({ id: `run_${i}`, status: "failed" }));
    expect(getHeatmapIntensity(busyDay)).toBe(4);
  });

  it("prioritizes failed over pending_approval, scheduled, and completed for the dominant kind", () => {
    const mixedDay = [
      makeRun({ id: "a", status: "verified" }),
      makeRun({ id: "b", status: "pending" }),
      makeRun({ id: "c", status: "failed" }),
    ];
    expect(getDominantRunKind(mixedDay)).toBe("failed");
  });

  it("returns null dominant kind for an empty day", () => {
    expect(getDominantRunKind([])).toBeNull();
  });
});

describe("PayrollCalendar heatmap rendering", () => {
  const runs: PayrollRun[] = [
    makeRun({ id: "run_scheduled", timestamp: "2025-06-05T09:00:00Z", status: "pending" }),
    makeRun({
      id: "run_pending_approval",
      timestamp: "2025-06-10T09:00:00Z",
      status: "pending",
      approvalStatus: "pending_executive_approval",
    }),
    makeRun({ id: "run_completed", timestamp: "2025-06-15T09:00:00Z", status: "verified" }),
    makeRun({ id: "run_failed", timestamp: "2025-06-20T09:00:00Z", status: "failed" }),
  ];

  it("renders a heatmap grid labeled with all four run kinds in the legend", () => {
    render(<PayrollCalendar runs={runs} />);

    expect(screen.getByRole("grid", { name: /payroll calendar/i })).toBeInTheDocument();
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending approval").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
  });

  it("labels a gridcell with its run count and dominant status for screen readers", () => {
    render(<PayrollCalendar runs={runs} />);

    const failedCell = screen.getByRole("gridcell", { name: /1 run \(failed\)/i });
    expect(failedCell).toBeInTheDocument();
  });
});
