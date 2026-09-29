import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollCalendar from "@/components/features/payroll/PayrollCalendar";
import { detectCalendarOverlaps } from "@/lib/payroll/scheduleUtils";
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

describe("detectCalendarOverlaps", () => {
  it("flags two scheduled runs landing on the same day", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "2025-06-15T09:00:00Z", status: "pending" }),
      makeRun({ id: "b", timestamp: "2025-06-15T14:00:00Z", status: "pending" }),
    ];

    const overlaps = detectCalendarOverlaps(runs);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].dateKey).toBe("2025-06-15");
    expect(overlaps[0].runs.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("flags overlap between a scheduled run and one pending executive approval", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "2025-06-15T09:00:00Z", status: "pending" }),
      makeRun({
        id: "b",
        timestamp: "2025-06-15T14:00:00Z",
        status: "pending",
        approvalStatus: "pending_executive_approval",
      }),
    ];

    const overlaps = detectCalendarOverlaps(runs);
    expect(overlaps).toHaveLength(1);
  });

  it("reports shared employee IDs across overlapping runs", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "2025-06-15T09:00:00Z", employeeIds: ["emp_1", "emp_2"] }),
      makeRun({ id: "b", timestamp: "2025-06-15T14:00:00Z", employeeIds: ["emp_2", "emp_3"] }),
    ];

    const overlaps = detectCalendarOverlaps(runs);
    expect(overlaps[0].sharedEmployeeIds).toEqual(["emp_2"]);
  });

  it("does not flag a single run on a day", () => {
    const runs = [makeRun({ id: "a", timestamp: "2025-06-15T09:00:00Z" })];
    expect(detectCalendarOverlaps(runs)).toHaveLength(0);
  });

  it("ignores completed and failed runs when detecting overlaps", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "2025-06-15T09:00:00Z", status: "verified" }),
      makeRun({ id: "b", timestamp: "2025-06-15T14:00:00Z", status: "failed" }),
    ];
    expect(detectCalendarOverlaps(runs)).toHaveLength(0);
  });

  it("does not flag an overlap between one active run and one resolved run on the same day", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "2025-06-15T09:00:00Z", status: "pending" }),
      makeRun({ id: "b", timestamp: "2025-06-15T14:00:00Z", status: "verified" }),
    ];
    expect(detectCalendarOverlaps(runs)).toHaveLength(0);
  });

  it("skips runs with a missing or unparsable date instead of throwing", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "", createdAt: "" }),
      makeRun({ id: "b", timestamp: "not-a-date", createdAt: "not-a-date" }),
    ];
    expect(() => detectCalendarOverlaps(runs)).not.toThrow();
    expect(detectCalendarOverlaps(runs)).toHaveLength(0);
  });

  it("returns multiple overlaps sorted by date", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "2025-07-01T09:00:00Z" }),
      makeRun({ id: "b", timestamp: "2025-07-01T14:00:00Z" }),
      makeRun({ id: "c", timestamp: "2025-06-15T09:00:00Z" }),
      makeRun({ id: "d", timestamp: "2025-06-15T14:00:00Z" }),
    ];

    const overlaps = detectCalendarOverlaps(runs);
    expect(overlaps.map((o) => o.dateKey)).toEqual(["2025-06-15", "2025-07-01"]);
  });
});

describe("PayrollCalendar overlap warning UI", () => {
  it("renders a warning banner naming the overlapping day when two active runs collide", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "2025-06-15T09:00:00Z", status: "pending" }),
      makeRun({ id: "b", timestamp: "2025-06-15T14:00:00Z", status: "pending" }),
    ];

    render(<PayrollCalendar runs={runs} />);

    const banner = screen.getByTestId("payroll-calendar-overlap-warning");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Jun 15, 2025/i);
  });

  it("does not render a warning banner when no runs overlap", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "2025-06-05T09:00:00Z", status: "pending" }),
      makeRun({ id: "b", timestamp: "2025-06-20T09:00:00Z", status: "verified" }),
    ];

    render(<PayrollCalendar runs={runs} />);

    expect(screen.queryByTestId("payroll-calendar-overlap-warning")).not.toBeInTheDocument();
  });

  it("marks the overlapping day's gridcell for screen readers", () => {
    const runs = [
      makeRun({ id: "a", timestamp: "2025-06-15T09:00:00Z", status: "pending" }),
      makeRun({ id: "b", timestamp: "2025-06-15T14:00:00Z", status: "pending" }),
    ];

    render(<PayrollCalendar runs={runs} />);

    expect(screen.getByRole("gridcell", { name: /scheduling overlap/i })).toBeInTheDocument();
  });
});
