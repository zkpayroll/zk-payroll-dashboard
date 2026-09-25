import { describe, it, expect } from "vitest";
import {
  toDateKey,
  parseDateKey,
  computeTemplateOccurrences,
  findMissedOccurrences,
  rangesOverlap,
  findOverlappingWindows,
} from "@/lib/date/scheduleWindows";
import type { PayrollTemplate, PayrollRun } from "@/types/models";

function makeTemplate(overrides: Partial<PayrollTemplate> = {}): PayrollTemplate {
  return {
    id: "tpl_test",
    companyId: "company_001",
    name: "Test Template",
    description: "",
    frequency: "monthly",
    employeeIds: [],
    dayOfMonth: 15,
    isActive: true,
    lastExecuted: null,
    nextScheduled: "2025-01-15T09:00:00Z",
    createdAt: "2024-12-01T00:00:00Z",
    updatedAt: "2024-12-01T00:00:00Z",
    createdBy: "test",
    ...overrides,
  };
}

function makeRun(overrides: Partial<PayrollRun> = {}): PayrollRun {
  return {
    id: "tx_test",
    status: "verified",
    approvalStatus: "approved",
    timestamp: "2025-01-15T09:00:00Z",
    createdAt: "2025-01-15T09:00:00Z",
    totalAmount: 1000,
    employeeCount: 1,
    employeeIds: ["emp_1"],
    ...overrides,
  } as PayrollRun;
}

describe("toDateKey / parseDateKey", () => {
  it("round-trips a date through toDateKey and parseDateKey", () => {
    const date = new Date(Date.UTC(2025, 2, 15));
    const key = toDateKey(date);
    expect(key).toBe("2025-03-15");
    expect(parseDateKey(key).getTime()).toBe(date.getTime());
  });
});

describe("computeTemplateOccurrences", () => {
  it("returns no occurrences for an inactive template", () => {
    const template = makeTemplate({ isActive: false });
    const occurrences = computeTemplateOccurrences(
      template,
      new Date(Date.UTC(2025, 0, 1)),
      new Date(Date.UTC(2025, 2, 31)),
    );
    expect(occurrences).toEqual([]);
  });

  it("computes monthly occurrences snapped to dayOfMonth within range", () => {
    const template = makeTemplate({ frequency: "monthly", dayOfMonth: 15, nextScheduled: "2025-01-15T00:00:00Z" });
    const occurrences = computeTemplateOccurrences(
      template,
      new Date(Date.UTC(2025, 0, 1)),
      new Date(Date.UTC(2025, 2, 31)),
    );
    const keys = occurrences.map(toDateKey);
    expect(keys).toContain("2025-01-15");
    expect(keys.length).toBeGreaterThanOrEqual(1);
    for (const key of keys) {
      expect(key.endsWith("-15")).toBe(true);
    }
  });

  it("clamps dayOfMonth to the last day of a shorter month", () => {
    const template = makeTemplate({ frequency: "monthly", dayOfMonth: 31, nextScheduled: "2025-01-31T00:00:00Z" });
    const occurrences = computeTemplateOccurrences(
      template,
      new Date(Date.UTC(2025, 1, 1)),
      new Date(Date.UTC(2025, 1, 28)),
    );
    const keys = occurrences.map(toDateKey);
    // February 2025 has 28 days — a day-31 template should clamp to Feb 28.
    expect(keys).toContain("2025-02-28");
  });

  it("computes weekly occurrences snapped to dayOfWeek", () => {
    const template = makeTemplate({
      frequency: "weekly",
      dayOfMonth: undefined,
      dayOfWeek: 5, // Friday
      nextScheduled: "2025-01-03T00:00:00Z", // a Friday
    });
    const occurrences = computeTemplateOccurrences(
      template,
      new Date(Date.UTC(2025, 0, 1)),
      new Date(Date.UTC(2025, 0, 31)),
    );
    for (const date of occurrences) {
      expect(date.getUTCDay()).toBe(5);
    }
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
  });

  it("returns an empty array when the range is entirely before any occurrence", () => {
    const template = makeTemplate({ nextScheduled: "2030-01-15T00:00:00Z" });
    const occurrences = computeTemplateOccurrences(
      template,
      new Date(Date.UTC(2020, 0, 1)),
      new Date(Date.UTC(2020, 0, 31)),
    );
    expect(occurrences).toEqual([]);
  });
});

describe("findMissedOccurrences", () => {
  it("flags a past occurrence with no matching run as missed", () => {
    const template = makeTemplate({ nextScheduled: "2025-01-15T00:00:00Z" });
    const asOf = new Date(Date.UTC(2025, 1, 1));
    const missed = findMissedOccurrences(
      [template],
      [], // no runs at all
      new Date(Date.UTC(2025, 0, 1)),
      asOf,
    );
    expect(missed.length).toBeGreaterThan(0);
    expect(missed[0].templateId).toBe(template.id);
  });

  it("does not flag an occurrence with a matching run within the grace window", () => {
    const template = makeTemplate({ nextScheduled: "2025-01-15T00:00:00Z" });
    const run = makeRun({ timestamp: "2025-01-16T00:00:00Z" }); // 1 day off, within grace
    const missed = findMissedOccurrences(
      [template],
      [run],
      new Date(Date.UTC(2025, 0, 1)),
      new Date(Date.UTC(2025, 1, 1)),
    );
    expect(missed).toEqual([]);
  });

  it("does not flag future occurrences as missed", () => {
    const template = makeTemplate({ nextScheduled: "2025-06-15T00:00:00Z" });
    const missed = findMissedOccurrences(
      [template],
      [],
      new Date(Date.UTC(2025, 0, 1)),
      new Date(Date.UTC(2025, 1, 1)), // asOf is before the occurrence
    );
    expect(missed).toEqual([]);
  });
});

describe("rangesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(rangesOverlap({ start: "2025-01-01", end: "2025-01-10" }, { start: "2025-01-05", end: "2025-01-15" })).toBe(true);
  });

  it("detects non-overlapping ranges", () => {
    expect(rangesOverlap({ start: "2025-01-01", end: "2025-01-10" }, { start: "2025-01-11", end: "2025-01-20" })).toBe(false);
  });

  it("treats touching boundaries as overlapping (inclusive)", () => {
    expect(rangesOverlap({ start: "2025-01-01", end: "2025-01-10" }, { start: "2025-01-10", end: "2025-01-20" })).toBe(true);
  });
});

describe("findOverlappingWindows", () => {
  it("returns no overlap for a candidate with no existing windows", () => {
    const result = findOverlappingWindows({ start: "2025-01-01", end: "2025-01-10" }, []);
    expect(result.hasOverlap).toBe(false);
  });

  it("finds a conflicting window", () => {
    const result = findOverlappingWindows(
      { start: "2025-01-05", end: "2025-01-15" },
      [{ id: "w1", range: { start: "2025-01-01", end: "2025-01-10" } }],
    );
    expect(result.hasOverlap).toBe(true);
    expect(result.conflictsWith).toEqual(["w1"]);
  });

  it("excludes the window being edited from conflict checks", () => {
    const result = findOverlappingWindows(
      { start: "2025-01-05", end: "2025-01-15" },
      [{ id: "w1", range: { start: "2025-01-01", end: "2025-01-10" } }],
      "w1",
    );
    expect(result.hasOverlap).toBe(false);
  });

  it("returns no overlap for an invalid range (start after end)", () => {
    const result = findOverlappingWindows(
      { start: "2025-01-15", end: "2025-01-05" },
      [{ id: "w1", range: { start: "2025-01-01", end: "2025-01-10" } }],
    );
    expect(result.hasOverlap).toBe(false);
  });
});
