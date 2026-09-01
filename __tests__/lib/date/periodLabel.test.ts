import { describe, it, expect } from "vitest";
import {
  formatPeriodLabel,
  formatShortPeriodLabel,
  formatPeriodId,
  parsePeriod,
  isPeriodValid,
} from "@/lib/date/periodLabel";
import type { PayrollRun, PayrollTransaction } from "@/types/models";

describe("periodLabel utility", () => {
  describe("parsePeriod", () => {
    it("parses standard ISO date timestamps in UTC", () => {
      const parsed = parsePeriod("2025-02-28T09:01:00Z");
      expect(parsed.isValid).toBe(true);
      expect(parsed.label).toBe("February 2025");
      expect(parsed.shortLabel).toBe("Feb 2025");
      expect(parsed.periodId).toBe("2025-02");
      expect(parsed.year).toBe(2025);
      expect(parsed.month).toBe(2);
    });

    it("parses ISO YYYY-MM strings", () => {
      const parsed = parsePeriod("2026-07");
      expect(parsed.isValid).toBe(true);
      expect(parsed.label).toBe("July 2026");
      expect(parsed.shortLabel).toBe("Jul 2026");
      expect(parsed.periodId).toBe("2026-07");
      expect(parsed.year).toBe(2026);
      expect(parsed.month).toBe(7);
    });

    it("parses period_YYYY_MM prefixed format", () => {
      const parsed = parsePeriod("period_2026_01");
      expect(parsed.isValid).toBe(true);
      expect(parsed.label).toBe("January 2026");
      expect(parsed.shortLabel).toBe("Jan 2026");
      expect(parsed.periodId).toBe("2026-01");
    });

    it("parses payroll_period_YYYY_MM format", () => {
      const parsed = parsePeriod("payroll_period-2025-11");
      expect(parsed.isValid).toBe(true);
      expect(parsed.label).toBe("November 2025");
      expect(parsed.periodId).toBe("2025-11");
    });

    it("parses quarterly period strings (Q1 2026 and 2026-Q3)", () => {
      const q1 = parsePeriod("Q1 2026");
      expect(q1.isValid).toBe(true);
      expect(q1.label).toBe("Q1 2026");
      expect(q1.quarter).toBe(1);
      expect(q1.year).toBe(2026);

      const q3 = parsePeriod("2026-Q3");
      expect(q3.isValid).toBe(true);
      expect(q3.label).toBe("Q3 2026");
      expect(q3.quarter).toBe(3);
      expect(q3.year).toBe(2026);
    });

    it("parses human month-year strings (e.g. 'Aug 2025' or 'March 2026')", () => {
      const aug = parsePeriod("Aug 2025");
      expect(aug.isValid).toBe(true);
      expect(aug.label).toBe("August 2025");
      expect(aug.shortLabel).toBe("Aug 2025");
      expect(aug.periodId).toBe("2025-08");

      const march = parsePeriod("March 2026");
      expect(march.isValid).toBe(true);
      expect(march.label).toBe("March 2026");
      expect(march.periodId).toBe("2026-03");
    });

    it("parses Date instances", () => {
      const date = new Date(Date.UTC(2025, 9, 15)); // October 2025
      const parsed = parsePeriod(date);
      expect(parsed.isValid).toBe(true);
      expect(parsed.label).toBe("October 2025");
      expect(parsed.shortLabel).toBe("Oct 2025");
      expect(parsed.periodId).toBe("2025-10");
    });

    it("parses PayrollRun and PayrollTransaction objects", () => {
      const tx: Partial<PayrollTransaction> = {
        id: "tx_123",
        createdAt: "2025-04-10T12:00:00Z",
      };
      const parsed = parsePeriod(tx);
      expect(parsed.isValid).toBe(true);
      expect(parsed.label).toBe("April 2025");
    });

    // Failure / Error paths
    it("returns invalid result for null, undefined, or empty strings", () => {
      expect(parsePeriod(null).isValid).toBe(false);
      expect(parsePeriod(undefined).isValid).toBe(false);
      expect(parsePeriod("").isValid).toBe(false);
      expect(parsePeriod("   ").isValid).toBe(false);
    });

    it("returns invalid result for malformed string inputs", () => {
      const result = parsePeriod("not-a-valid-date-or-period");
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns invalid result for invalid Date objects", () => {
      const badDate = new Date("invalid date string");
      const result = parsePeriod(badDate);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid Date");
    });

    // Edge Cases
    it("handles leap day (Feb 29) correctly", () => {
      const parsed = parsePeriod("2024-02-29T12:00:00Z");
      expect(parsed.isValid).toBe(true);
      expect(parsed.label).toBe("February 2024");
      expect(parsed.year).toBe(2024);
      expect(parsed.month).toBe(2);
    });

    it("handles UTC year-boundary timestamps without shifting month or year", () => {
      // Midnight Dec 31 UTC
      const dec31 = parsePeriod("2024-12-31T23:59:59Z");
      expect(dec31.isValid).toBe(true);
      expect(dec31.label).toBe("December 2024");
      expect(dec31.periodId).toBe("2024-12");

      // Midnight Jan 1 UTC
      const jan1 = parsePeriod("2025-01-01T00:00:00Z");
      expect(jan1.isValid).toBe(true);
      expect(jan1.label).toBe("January 2025");
      expect(jan1.periodId).toBe("2025-01");
    });
  });

  describe("formatPeriodLabel", () => {
    it("formats valid inputs as long label by default", () => {
      expect(formatPeriodLabel("2025-03-31T09:00:00Z")).toBe("March 2025");
      expect(formatPeriodLabel("2026-07")).toBe("July 2026");
    });

    it("supports short formatting style", () => {
      expect(formatPeriodLabel("2025-03-31T09:00:00Z", { format: "short" })).toBe("Mar 2025");
    });

    it("supports ID formatting style", () => {
      expect(formatPeriodLabel("2025-03-31T09:00:00Z", { format: "id" })).toBe("2025-03");
    });

    it("supports prefix option", () => {
      expect(
        formatPeriodLabel("2025-03-31T09:00:00Z", { prefix: "Period: " })
      ).toBe("Period: March 2025");
    });

    it("returns default fallback for invalid inputs", () => {
      expect(formatPeriodLabel("invalid")).toBe("Unassigned period");
      expect(formatPeriodLabel(null)).toBe("Unassigned period");
      expect(formatPeriodLabel(undefined)).toBe("Unassigned period");
    });

    it("returns custom fallback when specified", () => {
      expect(formatPeriodLabel("invalid", { fallback: "N/A" })).toBe("N/A");
      expect(formatPeriodLabel(null, { fallback: "" })).toBe("");
    });
  });

  describe("formatShortPeriodLabel", () => {
    it("formats compact period label", () => {
      expect(formatShortPeriodLabel("2025-02-28T09:01:00Z")).toBe("Feb 2025");
    });

    it("returns fallback for invalid inputs", () => {
      expect(formatShortPeriodLabel("invalid", "No period")).toBe("No period");
    });
  });

  describe("formatPeriodId", () => {
    it("formats ISO period ID", () => {
      expect(formatPeriodId("2025-02-28T09:01:00Z")).toBe("2025-02");
    });
  });

  describe("isPeriodValid", () => {
    it("returns true for valid inputs and false for invalid inputs", () => {
      expect(isPeriodValid("2025-02")).toBe(true);
      expect(isPeriodValid("2025-02-28T09:01:00Z")).toBe(true);
      expect(isPeriodValid("Q1 2026")).toBe(true);
      expect(isPeriodValid("nope")).toBe(false);
      expect(isPeriodValid(null)).toBe(false);
    });
  });
});
