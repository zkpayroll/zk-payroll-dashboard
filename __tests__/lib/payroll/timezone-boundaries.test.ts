import { describe, expect, it } from "vitest";
import {
  classifyPayrollInstant,
  describePayrollTimezoneBoundary,
  evaluatePayrollTimezoneBoundary,
  getZoneDateKey,
} from "@/lib/payroll/timezoneBoundaries";

const UTC_WINDOW = {
  startUtc: "2026-01-15T00:00:00Z",
  endUtc: "2026-01-31T23:59:59Z",
};

describe("evaluatePayrollTimezoneBoundary", () => {
  it("evaluates a UTC window with no date shift when the zone matches UTC", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      ...UTC_WINDOW,
      timeZone: "UTC",
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.error).toBeNull();
    expect(evaluation.startUtcDateKey).toBe("2026-01-15");
    expect(evaluation.endUtcDateKey).toBe("2026-01-31");
    expect(evaluation.startZoneDateKey).toBe("2026-01-15");
    expect(evaluation.endZoneDateKey).toBe("2026-01-31");
    expect(evaluation.startShiftedAcrossDay).toBe(false);
    expect(evaluation.endShiftedAcrossDay).toBe(false);
    expect(evaluation.spansMultipleZoneDays).toBe(true);
  });

  it("flags a UTC boundary that already fell on the next local day in a positive-offset zone", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      startUtc: "2026-01-14T23:30:00Z",
      endUtc: "2026-01-15T10:00:00Z",
      timeZone: "Africa/Lagos",
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.startUtcDateKey).toBe("2026-01-14");
    expect(evaluation.startZoneDateKey).toBe("2026-01-15");
    expect(evaluation.startShiftedAcrossDay).toBe(true);
    expect(evaluation.endZoneDateKey).toBe("2026-01-15");
    expect(evaluation.endShiftedAcrossDay).toBe(false);
    expect(evaluation.spansMultipleZoneDays).toBe(false);
  });

  it("flags a UTC boundary that is still on the previous local day in a negative-offset zone", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      startUtc: "2026-01-15T02:00:00Z",
      endUtc: "2026-01-16T04:59:59Z",
      timeZone: "America/New_York",
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.startUtcDateKey).toBe("2026-01-15");
    expect(evaluation.startZoneDateKey).toBe("2026-01-14");
    expect(evaluation.startShiftedAcrossDay).toBe(true);
    expect(evaluation.endUtcDateKey).toBe("2026-01-16");
    expect(evaluation.endZoneDateKey).toBe("2026-01-15");
    expect(evaluation.endShiftedAcrossDay).toBe(true);
  });

  it("never rewrites the stored UTC timestamps", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      ...UTC_WINDOW,
      timeZone: "Africa/Lagos",
    });

    expect(evaluation.startUtc).toBe("2026-01-15T00:00:00.000Z");
    expect(evaluation.endUtc).toBe("2026-01-31T23:59:59.000Z");
  });

  it("rejects an invalid IANA timezone", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      ...UTC_WINDOW,
      timeZone: "Not/AZone",
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.error).toContain("not a valid IANA timezone");
    expect(evaluation.startZoneDateKey).toBeNull();
    expect(evaluation.endZoneDateKey).toBeNull();
    expect(evaluation.startShiftedAcrossDay).toBe(false);
  });

  it("rejects a missing start", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      startUtc: "",
      endUtc: UTC_WINDOW.endUtc,
      timeZone: "UTC",
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.error).toContain("start");
    expect(evaluation.startUtc).toBeNull();
  });

  it("rejects an unparseable end", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      startUtc: UTC_WINDOW.startUtc,
      endUtc: "not-a-date",
      timeZone: "UTC",
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.error).toContain("end");
    expect(evaluation.endUtcDateKey).toBeNull();
  });

  it("rejects a window that ends before it starts", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      startUtc: "2026-01-31T00:00:00Z",
      endUtc: "2026-01-15T00:00:00Z",
      timeZone: "UTC",
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.error).toContain("ends before it starts");
  });

  it("accepts a zero-length window at a single instant", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      startUtc: "2026-01-15T12:00:00Z",
      endUtc: "2026-01-15T12:00:00Z",
      timeZone: "UTC",
    });

    expect(evaluation.valid).toBe(true);
    expect(evaluation.startZoneDateKey).toBe(evaluation.endZoneDateKey);
    expect(evaluation.spansMultipleZoneDays).toBe(false);
  });
});

describe("getZoneDateKey", () => {
  it("returns the local calendar day for a valid zone", () => {
    expect(getZoneDateKey("2026-01-14T23:30:00Z", "Africa/Lagos")).toBe("2026-01-15");
    expect(getZoneDateKey("2026-01-14T23:30:00Z", "UTC")).toBe("2026-01-14");
  });

  it("returns null for an invalid zone", () => {
    expect(getZoneDateKey("2026-01-14T23:30:00Z", "Not/AZone")).toBeNull();
  });

  it("returns null for an unparseable value", () => {
    expect(getZoneDateKey("whenever", "UTC")).toBeNull();
  });
});

describe("classifyPayrollInstant", () => {
  const window = {
    startUtc: "2026-01-15T00:00:00Z",
    endUtc: "2026-01-31T23:59:59Z",
    timeZone: "UTC",
  };

  it("treats both boundary instants as within the window", () => {
    expect(classifyPayrollInstant("2026-01-15T00:00:00Z", window)).toBe("within");
    expect(classifyPayrollInstant("2026-01-31T23:59:59Z", window)).toBe("within");
  });

  it("classifies instants outside the window", () => {
    expect(classifyPayrollInstant("2026-01-14T23:59:59Z", window)).toBe("before");
    expect(classifyPayrollInstant("2026-02-01T00:00:00Z", window)).toBe("after");
  });

  it("classifies an instant inside the window", () => {
    expect(classifyPayrollInstant("2026-01-20T12:00:00Z", window)).toBe("within");
  });

  it("returns null when the window is invalid", () => {
    expect(
      classifyPayrollInstant("2026-01-20T12:00:00Z", { ...window, timeZone: "Not/AZone" }),
    ).toBeNull();
  });

  it("returns null when the instant is unusable", () => {
    expect(classifyPayrollInstant("tomorrow-ish", window)).toBeNull();
  });
});

describe("describePayrollTimezoneBoundary", () => {
  it("explains a window whose calendar days match UTC", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      ...UTC_WINDOW,
      timeZone: "UTC",
    });

    const description = describePayrollTimezoneBoundary(evaluation);
    expect(description).toContain("In UTC this payroll window runs from 2026-01-15 to 2026-01-31.");
    expect(description).toContain("Calendar-day boundaries match UTC");
    expect(description).toContain("Stored UTC timestamps are unchanged");
  });

  it("explains both shifted edges when the zone moves the boundary days", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      startUtc: "2026-01-14T23:00:00Z",
      endUtc: "2026-01-15T23:30:00Z",
      timeZone: "Africa/Lagos",
    });

    const description = describePayrollTimezoneBoundary(evaluation);
    expect(description).toContain("In Africa/Lagos this payroll window runs from 2026-01-15 to 2026-01-16.");
    expect(description).toContain(
      "The window opens on 2026-01-14 in UTC, which is already 2026-01-15 in Africa/Lagos.",
    );
    expect(description).toContain(
      "The window closes on 2026-01-15 in UTC, which is already 2026-01-16 in Africa/Lagos.",
    );
    expect(description).not.toContain("Calendar-day boundaries match UTC");
  });

  it("returns the validation error for an invalid evaluation", () => {
    const evaluation = evaluatePayrollTimezoneBoundary({
      ...UTC_WINDOW,
      timeZone: "Not/AZone",
    });

    expect(describePayrollTimezoneBoundary(evaluation)).toContain("not a valid IANA timezone");
  });
});
