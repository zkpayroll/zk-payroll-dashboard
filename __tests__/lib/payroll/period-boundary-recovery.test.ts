import { describe, it, expect } from "vitest";
import {
  evaluatePeriodBoundaryRecovery,
  applyPeriodBoundaryRecoveryAction,
  calculateStandardWindow,
  findNextAvailableWindow,
  formatUtcDateKey,
  parseUtcDateKey,
  addDaysToDateKey,
  daysBetweenDateKeys,
  getFrequencyDurationDays,
} from "@/lib/payroll/periodBoundaryRecovery";

describe("Period Boundary Recovery - Date Utilities", () => {
  it("formats and parses UTC date keys reliably", () => {
    const date = new Date(Date.UTC(2025, 2, 15));
    expect(formatUtcDateKey(date)).toBe("2025-03-15");

    const parsed = parseUtcDateKey("2025-03-15");
    expect(parsed).not.toBeNull();
    expect(parsed?.getUTCFullYear()).toBe(2025);
    expect(parsed?.getUTCMonth()).toBe(2);
    expect(parsed?.getUTCDate()).toBe(15);
  });

  it("returns null for malformed date keys", () => {
    expect(parseUtcDateKey("not-a-date")).toBeNull();
    expect(parseUtcDateKey("2025-02-29")).toBeNull(); // 2025 is not a leap year
    expect(parseUtcDateKey("2025-13-01")).toBeNull();
  });

  it("adds days across month and leap-year boundaries", () => {
    expect(addDaysToDateKey("2024-02-28", 1)).toBe("2024-02-29"); // leap year
    expect(addDaysToDateKey("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDaysToDateKey("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("calculates inclusive days between two date keys", () => {
    expect(daysBetweenDateKeys("2025-01-01", "2025-01-01")).toBe(1);
    expect(daysBetweenDateKeys("2025-01-01", "2025-01-14")).toBe(14);
  });

  it("returns standard duration for frequencies", () => {
    expect(getFrequencyDurationDays("weekly")).toBe(7);
    expect(getFrequencyDurationDays("biweekly")).toBe(14);
    expect(getFrequencyDurationDays("monthly")).toBe(30);
    expect(getFrequencyDurationDays("quarterly")).toBe(90);
  });

  it("calculates standard window snapping for monthly starting on 1st", () => {
    const window = calculateStandardWindow("2025-02-01", "monthly");
    expect(window).toEqual({ start: "2025-02-01", end: "2025-02-28" });
  });
});

describe("Period Boundary Recovery - evaluatePeriodBoundaryRecovery", () => {
  it("evaluates a valid, non-overlapping window as healthy", () => {
    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-03-01",
      end: "2025-03-15",
      templateId: "tpl_1",
      existingWindows: [
        { id: "w_1", templateId: "tpl_1", start: "2025-01-01", end: "2025-01-15" },
      ],
    });

    expect(plan.valid).toBe(true);
    expect(plan.status).toBe("healthy");
    expect(plan.recommendedAction).toBe("none");
    expect(plan.conflictingWindows).toHaveLength(0);
    expect(plan.actionableMessage).toContain("valid");
  });

  it("accepts a one-day window as valid and healthy at the boundary", () => {
    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-03-15",
      end: "2025-03-15",
      templateId: "tpl_1",
    });

    expect(plan.valid).toBe(true);
    expect(plan.status).toBe("healthy");
    expect(plan.recommendedAction).toBe("none");
  });

  it("accepts adjacent windows that touch without overlap", () => {
    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-03-16",
      end: "2025-03-31",
      templateId: "tpl_1",
      existingWindows: [
        { id: "w_1", templateId: "tpl_1", start: "2025-03-01", end: "2025-03-15" },
      ],
    });

    expect(plan.valid).toBe(true);
    expect(plan.status).toBe("healthy");
    expect(plan.conflictingWindows).toHaveLength(0);
  });

  it("detects inverted boundaries (start > end) and recommends swap_dates", () => {
    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-03-20",
      end: "2025-03-05",
      templateId: "tpl_1",
    });

    expect(plan.valid).toBe(false);
    expect(plan.status).toBe("inverted");
    expect(plan.recommendedAction).toBe("swap_dates");
    expect(plan.suggestedWindow).toEqual({
      start: "2025-03-05",
      end: "2025-03-20",
    });
    expect(plan.actionableMessage).toContain("falls before");

    const swapAction = plan.actions.find((a) => a.action === "swap_dates");
    expect(swapAction).toBeDefined();
    expect(swapAction?.enabled).toBe(true);
  });

  it("detects malformed start date and recommends alignment", () => {
    const plan = evaluatePeriodBoundaryRecovery({
      start: "invalid-date",
      end: "2025-03-15",
      templateId: "tpl_1",
    });

    expect(plan.valid).toBe(false);
    expect(plan.status).toBe("invalid_start");
    expect(plan.recommendedAction).toBe("align_to_preceding");
    expect(plan.actionableMessage).toContain("start date is invalid");
  });

  it("detects malformed end date and recommends standard expansion", () => {
    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-03-01",
      end: "not-a-real-date",
      templateId: "tpl_1",
      templateFrequency: "biweekly",
    });

    expect(plan.valid).toBe(false);
    expect(plan.status).toBe("invalid_end");
    expect(plan.recommendedAction).toBe("expand_standard_window");
    expect(plan.suggestedWindow).toEqual({
      start: "2025-03-01",
      end: "2025-03-14",
    });
    expect(plan.actionableMessage).toContain("end date is invalid");
  });

  it("detects same-template boundary overlap and recommends shift_next_available", () => {
    const existing = [
      { id: "w_1", templateId: "tpl_1", start: "2025-03-01", end: "2025-03-10" },
    ];

    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-03-05",
      end: "2025-03-15",
      templateId: "tpl_1",
      existingWindows: existing,
    });

    expect(plan.valid).toBe(false);
    expect(plan.status).toBe("overlap");
    expect(plan.recommendedAction).toBe("shift_next_available");
    expect(plan.conflictingWindows).toHaveLength(1);
    expect(plan.conflictingWindows[0].id).toBe("w_1");
    expect(plan.crossTemplateConflict).toBe(false);

    // Duration is 11 days (March 5 to March 15 inclusive).
    // Latest conflicting end is March 10. Next start is March 11.
    // Next end = March 11 + 10 days = March 21.
    expect(plan.suggestedWindow).toEqual({
      start: "2025-03-11",
      end: "2025-03-21",
    });
  });

  it("shifts past multiple sequential conflicts until a free window is found", () => {
    const existing = [
      { id: "w_1", templateId: "tpl_1", start: "2025-03-01", end: "2025-03-10" },
      { id: "w_2", templateId: "tpl_1", start: "2025-03-11", end: "2025-03-20" },
    ];

    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-03-05",
      end: "2025-03-12", // 8 days
      templateId: "tpl_1",
      existingWindows: existing,
    });

    expect(plan.status).toBe("overlap");
    // Free window starts after w_2 ends on March 20 -> March 21 to March 28
    expect(plan.suggestedWindow).toEqual({
      start: "2025-03-21",
      end: "2025-03-28",
    });
  });

  it("detects cross-template boundary conflict and names the conflicting template", () => {
    const existing = [
      {
        id: "w_other",
        templateId: "tpl_other",
        templateName: "Executive Payroll",
        start: "2025-04-01",
        end: "2025-04-15",
      },
    ];

    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-04-10",
      end: "2025-04-20",
      templateId: "tpl_engineering",
      existingWindows: existing,
    });

    expect(plan.valid).toBe(false);
    expect(plan.status).toBe("overlap");
    expect(plan.crossTemplateConflict).toBe(true);
    expect(plan.actionableMessage).toContain("Executive Payroll");
  });

  it("excludes self window ID during edit evaluation", () => {
    const existing = [
      { id: "w_self", templateId: "tpl_1", start: "2025-05-01", end: "2025-05-15" },
    ];

    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-05-02",
      end: "2025-05-16",
      templateId: "tpl_1",
      existingWindows: existing,
      excludeId: "w_self",
    });

    expect(plan.valid).toBe(true);
    expect(plan.status).toBe("healthy");
  });

  it("evaluates timezone spillover without modifying stored UTC boundaries", () => {
    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-06-01",
      end: "2025-06-15",
      templateId: "tpl_1",
      timeZone: "America/New_York",
    });

    expect(plan.valid).toBe(true);
    expect(plan.candidate).toEqual({ start: "2025-06-01", end: "2025-06-15" });
  });

  it("never includes private employee or salary figures in messages", () => {
    const plan = evaluatePeriodBoundaryRecovery({
      start: "2025-03-10",
      end: "2025-03-01",
      templateId: "tpl_1",
      existingWindows: [
        { id: "w_1", templateId: "tpl_1", start: "2025-03-01", end: "2025-03-15" },
      ],
    });

    const combinedOutput = JSON.stringify(plan);
    expect(combinedOutput).not.toMatch(/salary|usd|xlm|amount|employee|emp_|balance|wallet/i);
  });
});

describe("Period Boundary Recovery - applyPeriodBoundaryRecoveryAction", () => {
  it("applies swap_dates action correctly", () => {
    const result = applyPeriodBoundaryRecoveryAction("swap_dates", {
      start: "2025-06-20",
      end: "2025-06-10",
    });

    expect(result.ok).toBe(true);
    expect(result.recoveredWindow).toEqual({
      start: "2025-06-10",
      end: "2025-06-20",
    });
  });

  it("applies shift_next_available action correctly", () => {
    const existing = [
      { id: "w_1", templateId: "tpl_1", start: "2025-07-01", end: "2025-07-15" },
    ];

    const result = applyPeriodBoundaryRecoveryAction("shift_next_available", {
      start: "2025-07-05",
      end: "2025-07-10", // 6 days
      existingWindows: existing,
    });

    expect(result.ok).toBe(true);
    expect(result.recoveredWindow).toEqual({
      start: "2025-07-16",
      end: "2025-07-21",
    });
  });

  it("applies expand_standard_window action for weekly frequency", () => {
    const result = applyPeriodBoundaryRecoveryAction("expand_standard_window", {
      start: "2025-08-01",
      end: "invalid",
      templateFrequency: "weekly",
    });

    expect(result.ok).toBe(true);
    expect(result.recoveredWindow).toEqual({
      start: "2025-08-01",
      end: "2025-08-07",
    });
  });

  it("handles none action gracefully", () => {
    const result = applyPeriodBoundaryRecoveryAction("none", {
      start: "2025-09-01",
      end: "2025-09-15",
    });

    expect(result.ok).toBe(true);
    expect(result.recoveredWindow).toEqual({
      start: "2025-09-01",
      end: "2025-09-15",
    });
  });
});
