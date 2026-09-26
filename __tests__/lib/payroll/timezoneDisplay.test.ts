import { describe, it, expect } from "vitest";
import {
  formatInDisplayZone,
  getLocalTimeZone,
  getTimeZoneAbbreviation,
  isValidIANATimeZone,
  resolveDisplayTimeZone,
} from "@/lib/payroll/timezoneDisplay";

const SAMPLE = new Date("2026-01-15T14:30:00Z");

describe("isValidIANATimeZone", () => {
  it("accepts valid IANA zones", () => {
    expect(isValidIANATimeZone("UTC")).toBe(true);
    expect(isValidIANATimeZone("America/New_York")).toBe(true);
  });

  it("rejects empty and malformed zones", () => {
    expect(isValidIANATimeZone("")).toBe(false);
    expect(isValidIANATimeZone("Not/AZone")).toBe(false);
  });
});

describe("resolveDisplayTimeZone", () => {
  it("returns UTC for utc mode", () => {
    expect(resolveDisplayTimeZone({ mode: "utc", organizationTimeZone: "Asia/Tokyo" })).toBe("UTC");
  });

  it("returns the organization zone for organization mode", () => {
    expect(
      resolveDisplayTimeZone({ mode: "organization", organizationTimeZone: "Europe/Berlin" }),
    ).toBe("Europe/Berlin");
  });

  it("falls back to UTC when the organization zone is invalid", () => {
    expect(resolveDisplayTimeZone({ mode: "organization", organizationTimeZone: "Bad/Zone" })).toBe("UTC");
    expect(resolveDisplayTimeZone({ mode: "organization", organizationTimeZone: "" })).toBe("UTC");
  });

  it("returns the runtime local zone for local mode", () => {
    const local = resolveDisplayTimeZone({ mode: "local", organizationTimeZone: "UTC" });
    expect(local).toBe(getLocalTimeZone());
    expect(isValidIANATimeZone(local)).toBe(true);
  });
});

describe("formatInDisplayZone", () => {
  it("renders the same instant differently per zone with a zone label", () => {
    const utc = formatInDisplayZone(SAMPLE, "UTC");
    const newYork = formatInDisplayZone(SAMPLE, "America/New_York");

    expect(utc).toContain("2:30 PM");
    expect(utc).toContain("UTC");
    expect(newYork).toContain("9:30 AM");
    expect(newYork).toContain("EST");
  });

  it("accepts ISO strings", () => {
    expect(formatInDisplayZone("2026-01-15T14:30:00Z", "UTC")).toContain("Jan 15, 2026");
  });

  it("omits the clock when includeTime is false", () => {
    const result = formatInDisplayZone(SAMPLE, "UTC", { includeTime: false });
    expect(result).not.toContain("PM");
    expect(result).toContain("UTC");
  });

  it("includes the weekday on request", () => {
    expect(formatInDisplayZone(SAMPLE, "UTC", { includeWeekday: true })).toContain("Thu");
  });

  it("renders an em dash for an invalid date (edge case)", () => {
    expect(formatInDisplayZone("not-a-date", "UTC")).toBe("—");
  });
});

describe("getTimeZoneAbbreviation", () => {
  it("returns short labels per zone", () => {
    expect(getTimeZoneAbbreviation(SAMPLE, "UTC")).toBe("UTC");
    expect(getTimeZoneAbbreviation(SAMPLE, "America/New_York")).toBe("EST");
  });
});
