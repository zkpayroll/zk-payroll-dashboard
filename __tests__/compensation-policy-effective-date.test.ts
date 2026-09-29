import { describe, it, expect } from "vitest";
import {
  assertCompensationPolicyEffectiveDate,
  CompensationPolicyEffectiveDateError,
  DEFAULT_COMPENSATION_HORIZON_DAYS,
  DEFAULT_COMPENSATION_REMEDIATION_ACTION,
  evaluateCompensationPolicyEffectiveDate,
  isCompensationPolicyStatus,
  isIsoCalendarDate,
  normalizeReferenceDate,
} from "@/lib/compensation/compensationPolicyEffectiveDate";
import type { CompensationPolicyScheduleEntry } from "@/types/compensation";

const REFERENCE_DATE = "2026-09-29";

function policy(
  overrides: Partial<CompensationPolicyScheduleEntry> &
    Pick<CompensationPolicyScheduleEntry, "id" | "effectiveDate">,
): CompensationPolicyScheduleEntry {
  return { status: "scheduled", ...overrides };
}

function evaluate(
  policies: unknown,
  options: { maxHorizonDays?: number; referenceDate?: string } = {},
) {
  return evaluateCompensationPolicyEffectiveDate(policies, {
    referenceDate: options.referenceDate ?? REFERENCE_DATE,
    ...(options.maxHorizonDays === undefined
      ? {}
      : { maxHorizonDays: options.maxHorizonDays }),
  });
}

describe("isIsoCalendarDate", () => {
  it("accepts real calendar days in YYYY-MM-DD form", () => {
    expect(isIsoCalendarDate("2026-10-01")).toBe(true);
    expect(isIsoCalendarDate("2026-02-28")).toBe(true);
    expect(isIsoCalendarDate("2024-02-29")).toBe(true);
    expect(isIsoCalendarDate("  2026-12-31  ")).toBe(true);
  });

  it("rejects impossible calendar days that Date.parse would roll forward", () => {
    expect(isIsoCalendarDate("2026-02-30")).toBe(false);
    expect(isIsoCalendarDate("2026-04-31")).toBe(false);
    expect(isIsoCalendarDate("2026-13-01")).toBe(false);
    expect(isIsoCalendarDate("2026-00-10")).toBe(false);
    expect(isIsoCalendarDate("2026-01-00")).toBe(false);
    expect(isIsoCalendarDate("2026-06-31")).toBe(false);
  });

  it("rejects leap days in non-leap years but accepts them in leap years", () => {
    expect(isIsoCalendarDate("2026-02-29")).toBe(false);
    expect(isIsoCalendarDate("2028-02-29")).toBe(true);
    expect(isIsoCalendarDate("2000-02-29")).toBe(true);
    expect(isIsoCalendarDate("1900-02-29")).toBe(false);
  });

  it("rejects non-ISO formats and non-strings", () => {
    expect(isIsoCalendarDate("")).toBe(false);
    expect(isIsoCalendarDate("   ")).toBe(false);
    expect(isIsoCalendarDate("10/01/2026")).toBe(false);
    expect(isIsoCalendarDate("2026-10-01T00:00:00Z")).toBe(false);
    expect(isIsoCalendarDate("2026-1-1")).toBe(false);
    expect(isIsoCalendarDate(20261001)).toBe(false);
    expect(isIsoCalendarDate(null)).toBe(false);
    expect(isIsoCalendarDate(undefined)).toBe(false);
  });
});

describe("isCompensationPolicyStatus", () => {
  it("recognizes every documented lifecycle status", () => {
    expect(isCompensationPolicyStatus("draft")).toBe(true);
    expect(isCompensationPolicyStatus("scheduled")).toBe(true);
    expect(isCompensationPolicyStatus("active")).toBe(true);
    expect(isCompensationPolicyStatus("superseded")).toBe(true);
  });

  it("rejects unknown or non-string statuses", () => {
    expect(isCompensationPolicyStatus("expired")).toBe(false);
    expect(isCompensationPolicyStatus("Active")).toBe(false);
    expect(isCompensationPolicyStatus("")).toBe(false);
    expect(isCompensationPolicyStatus(null)).toBe(false);
    expect(isCompensationPolicyStatus(1)).toBe(false);
  });
});

describe("normalizeReferenceDate", () => {
  it("defaults to today when no reference date is supplied", () => {
    const resolved = normalizeReferenceDate();
    expect(resolved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts calendar dates, timestamps, Date objects, and epoch milliseconds", () => {
    expect(normalizeReferenceDate("2026-09-29")).toBe("2026-09-29");
    expect(normalizeReferenceDate("2026-09-29T23:30:00.000Z")).toBe("2026-09-29");
    expect(normalizeReferenceDate(new Date("2026-09-29T06:00:00.000Z"))).toBe(
      "2026-09-29",
    );
    expect(normalizeReferenceDate(Date.UTC(2026, 8, 29))).toBe("2026-09-29");
  });

  it("throws a RangeError for developer-supplied values it cannot resolve", () => {
    expect(() => normalizeReferenceDate("")).toThrow(RangeError);
    expect(() => normalizeReferenceDate("   ")).toThrow(RangeError);
    expect(() => normalizeReferenceDate("not-a-date")).toThrow(RangeError);
    expect(() => normalizeReferenceDate("2026-02-30")).toThrow(RangeError);
    expect(() => normalizeReferenceDate(new Date("nope"))).toThrow(RangeError);
    expect(() => normalizeReferenceDate(Number.NaN)).toThrow(RangeError);
    expect(() => normalizeReferenceDate(Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
    expect(() =>
      normalizeReferenceDate({} as unknown as string),
    ).toThrow(RangeError);
  });
});

describe("evaluateCompensationPolicyEffectiveDate — valid schedules", () => {
  it("accepts an active revision plus a future scheduled revision", () => {
    const result = evaluate([
      policy({
        id: "comp_current",
        effectiveDate: "2026-08-01",
        status: "active",
      }),
      policy({ id: "comp_next", effectiveDate: "2026-10-15" }),
    ]);

    expect(result.status).toBe("valid");
    expect(result.canScheduleCompensationChanges).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.validPolicyCount).toBe(2);
    expect(result.nextEffectiveDate).toBe("2026-10-15");
    expect(result.daysUntilNextEffectiveDate).toBe(16);
    expect(result.remediationAction).toBeUndefined();
  });

  it("treats the reference date itself as a valid future effective date", () => {
    const result = evaluate([
      policy({ id: "comp_today", effectiveDate: REFERENCE_DATE }),
    ]);

    expect(result.status).toBe("valid");
    expect(result.nextEffectiveDate).toBe(REFERENCE_DATE);
    expect(result.daysUntilNextEffectiveDate).toBe(0);
  });

  it("exempts an active revision whose effective date is in the past", () => {
    const result = evaluate([
      policy({
        id: "comp_current",
        effectiveDate: "2020-01-01",
        status: "active",
      }),
    ]);

    expect(result.status).toBe("valid");
    expect(result.errors).toHaveLength(0);
    expect(result.nextEffectiveDate).toBeNull();
    expect(result.daysUntilNextEffectiveDate).toBeNull();
  });

  it("ignores superseded revisions when computing the next effective date", () => {
    const result = evaluate([
      policy({
        id: "comp_current",
        effectiveDate: "2026-01-01",
        status: "active",
      }),
      policy({
        id: "comp_old",
        effectiveDate: "2030-01-01",
        status: "superseded",
      }),
    ]);

    expect(result.status).toBe("valid");
    expect(result.nextEffectiveDate).toBeNull();
  });

  it("normalizes whitespace around the effective date in the reported entry", () => {
    const result = evaluate([
      policy({ id: "  comp_next  ", effectiveDate: "  2026-10-15  " }),
    ]);

    expect(result.checkedPolicies).toEqual([
      { id: "comp_next", effectiveDate: "2026-10-15", status: "scheduled" },
    ]);
  });

  it("does not mutate the caller's policy list", () => {
    const policies = [policy({ id: "comp_next", effectiveDate: "2026-10-15" })];
    const snapshot = JSON.stringify(policies);

    evaluate(policies);

    expect(JSON.stringify(policies)).toBe(snapshot);
  });
});

describe("evaluateCompensationPolicyEffectiveDate — structural failures", () => {
  it("blocks when no compensation policy is scheduled", () => {
    const result = evaluate([]);

    expect(result.status).toBe("invalid");
    expect(result.canScheduleCompensationChanges).toBe(false);
    expect(result.errors.map((e) => e.id)).toEqual(["no-policies-scheduled"]);
    expect(result.remediationAction).toEqual({
      ...DEFAULT_COMPENSATION_REMEDIATION_ACTION,
    });
  });

  it("blocks when the schedule is not a list", () => {
    for (const input of [null, undefined, "comp_next", 42, { id: "comp_next" }]) {
      const result = evaluate(input);

      expect(result.status).toBe("invalid");
      expect(result.errors.map((e) => e.id)).toEqual(["policies-not-a-list"]);
    }
  });

  it("blocks a pending revision with a missing effective date", () => {
    const result = evaluate([
      { id: "comp_next", status: "scheduled" } as unknown as CompensationPolicyScheduleEntry,
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.map((e) => e.id)).toEqual(["effective-date-missing"]);
    expect(result.errors[0].message).toContain("comp_next");
    expect(result.errors[0].remediation).toBeTruthy();
  });

  it("blocks a blank effective date", () => {
    const result = evaluate([
      policy({ id: "comp_next", effectiveDate: "   " }),
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.map((e) => e.id)).toEqual(["effective-date-missing"]);
  });

  it("blocks a malformed effective date", () => {
    const result = evaluate([
      policy({ id: "comp_next", effectiveDate: "10/15/2026" }),
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.map((e) => e.id)).toEqual(["effective-date-malformed"]);
    expect(result.errors[0].message).toContain("comp_next");
  });

  it("blocks an effective date that is not a real calendar day", () => {
    const result = evaluate([
      policy({ id: "comp_next", effectiveDate: "2026-02-30" }),
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.map((e) => e.id)).toEqual(["effective-date-malformed"]);
  });

  it("blocks revisions with a missing or unknown lifecycle status", () => {
    const missing = evaluate([
      { id: "comp_next", effectiveDate: "2026-10-15" } as unknown as CompensationPolicyScheduleEntry,
    ]);
    expect(missing.errors.map((e) => e.id)).toEqual(["policy-status-invalid"]);

    const unknown = evaluate([
      policy({
        id: "comp_next",
        effectiveDate: "2026-10-15",
        status: "expired" as CompensationPolicyScheduleEntry["status"],
      }),
    ]);
    expect(unknown.errors.map((e) => e.id)).toEqual(["policy-status-invalid"]);
    expect(unknown.errors[0].remediation).toContain("scheduled");
  });

  it("blocks revisions with a missing or oversized identifier", () => {
    const missing = evaluate([
      { effectiveDate: "2026-10-15", status: "scheduled" } as unknown as CompensationPolicyScheduleEntry,
    ]);
    expect(missing.errors.map((e) => e.id)).toEqual(["policy-id-invalid"]);

    const oversized = evaluate([
      policy({ id: "c".repeat(65), effectiveDate: "2026-10-15" }),
    ]);
    expect(oversized.errors.map((e) => e.id)).toEqual(["policy-id-invalid"]);
  });

  it("reports every problem with a single malformed entry at once", () => {
    const result = evaluate([
      { id: "", effectiveDate: "nope", status: "archived" } as unknown as CompensationPolicyScheduleEntry,
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.map((e) => e.id).sort()).toEqual([
      "effective-date-malformed",
      "policy-id-invalid",
      "policy-status-invalid",
    ]);
  });

  it("skips unreadable entries without hiding the rest of the schedule", () => {
    const result = evaluate([
      null,
      undefined,
      42,
      "comp_next",
      [],
      policy({ id: "comp_good", effectiveDate: "2026-10-15" }),
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.filter((e) => e.id === "policy-entry-invalid")).toHaveLength(5);
    expect(result.checkedPolicies).toEqual([
      { id: "comp_good", effectiveDate: "2026-10-15", status: "scheduled" },
    ]);
    expect(result.validPolicyCount).toBe(1);
  });
});

describe("evaluateCompensationPolicyEffectiveDate — ordering rules", () => {
  it("blocks a pending revision that would take effect in the past", () => {
    const result = evaluate([
      policy({ id: "comp_backdated", effectiveDate: "2026-09-28" }),
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.map((e) => e.id)).toEqual(["effective-date-in-past"]);
    expect(result.errors[0].message).toContain("1 day");
    expect(result.errors[0].remediation).toContain(REFERENCE_DATE);
  });

  it("uses plural wording for a backdated revision many days in the past", () => {
    const result = evaluate([
      policy({ id: "comp_backdated", effectiveDate: "2026-01-01" }),
    ]);

    expect(result.errors[0].message).toContain("271 days before");
  });

  it("blocks two revisions that share an effective date", () => {
    const result = evaluate([
      policy({ id: "comp_a", effectiveDate: "2026-10-15" }),
      policy({ id: "comp_b", effectiveDate: "2026-10-15" }),
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.map((e) => e.id)).toEqual([
      "effective-date-duplicate",
      "effective-date-duplicate",
    ]);
    expect(result.errors[0].message).toContain("comp_a, comp_b");
    expect(result.validPolicyCount).toBe(0);
  });

  it("blocks more than one active revision", () => {
    const result = evaluate([
      policy({ id: "comp_a", effectiveDate: "2026-08-01", status: "active" }),
      policy({ id: "comp_b", effectiveDate: "2026-09-01", status: "active" }),
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.map((e) => e.id)).toEqual([
      "multiple-active-policies",
      "multiple-active-policies",
    ]);
    expect(result.errors[0].message).toContain("comp_a, comp_b");
  });

  it("blocks a pending revision that would take effect before the active one", () => {
    const result = evaluate([
      policy({ id: "comp_current", effectiveDate: "2026-11-01", status: "active" }),
      policy({ id: "comp_early", effectiveDate: "2026-10-15" }),
    ]);

    expect(result.status).toBe("invalid");
    expect(result.errors.map((e) => e.id)).toEqual(["effective-date-before-active"]);
    expect(result.errors[0].title).toBe("Overlapping policy window");
    expect(result.errors[0].message).toContain("overlapping policy windows");
    expect(result.errors[0].message).toContain("comp_current");
    expect(result.errors[0].remediation).toContain("2026-11-01");
  });

  it("blocks an overlapping draft revision", () => {
    const result = evaluate([
      policy({ id: "comp_current", effectiveDate: "2026-11-01", status: "active" }),
      policy({ id: "comp_draft", effectiveDate: "2026-10-20", status: "draft" }),
    ]);

    expect(result.errors.map((e) => e.id)).toEqual(["effective-date-before-active"]);
  });

  it("allows a pending revision on the same day the active one takes effect", () => {
    const result = evaluate([
      policy({ id: "comp_current", effectiveDate: "2026-10-15", status: "active" }),
      policy({ id: "comp_rollover", effectiveDate: "2026-10-15" }),
    ]);

    // Same-day rollover is a duplicate date, not an overlap.
    expect(result.errors.map((e) => e.id)).toEqual([
      "effective-date-duplicate",
      "effective-date-duplicate",
    ]);
  });

  it("allows superseded revisions to predate the active revision", () => {
    const result = evaluate([
      policy({ id: "comp_current", effectiveDate: "2026-08-01", status: "active" }),
      policy({ id: "comp_old", effectiveDate: "2025-01-01", status: "superseded" }),
    ]);

    expect(result.status).toBe("valid");
  });

  it("does not apply the overlap rule when the active revision is ambiguous", () => {
    const result = evaluate([
      policy({ id: "comp_a", effectiveDate: "2026-08-01", status: "active" }),
      policy({ id: "comp_b", effectiveDate: "2026-09-01", status: "active" }),
      policy({ id: "comp_early", effectiveDate: "2026-07-01" }),
    ]);

    expect(result.errors.map((e) => e.id)).not.toContain(
      "effective-date-before-active",
    );
  });
});

describe("evaluateCompensationPolicyEffectiveDate — scheduling horizon", () => {
  it("warns without blocking when an effective date is beyond the horizon", () => {
    const result = evaluate([
      policy({ id: "comp_far", effectiveDate: "2028-10-15" }),
    ]);

    expect(result.status).toBe("warning");
    expect(result.canScheduleCompensationChanges).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.map((w) => w.id)).toEqual([
      "effective-date-beyond-horizon",
    ]);
    expect(result.warnings[0].message).toContain(
      `${DEFAULT_COMPENSATION_HORIZON_DAYS}-day scheduling horizon`,
    );
    expect(result.validPolicyCount).toBe(1);
    expect(result.remediationAction).toEqual({
      ...DEFAULT_COMPENSATION_REMEDIATION_ACTION,
    });
  });

  it("accepts an effective date exactly on the horizon boundary", () => {
    const result = evaluate(
      [policy({ id: "comp_edge", effectiveDate: "2027-11-03" })],
      { maxHorizonDays: 400 },
    );

    expect(result.status).toBe("valid");
    expect(result.warnings).toHaveLength(0);
  });

  it("honours a custom scheduling horizon", () => {
    const result = evaluate(
      [policy({ id: "comp_edge", effectiveDate: "2026-10-15" })],
      { maxHorizonDays: 7 },
    );

    expect(result.status).toBe("warning");
    expect(result.warnings[0].message).toContain("7-day scheduling horizon");
  });

  it("falls back to the default horizon and warns when the horizon is invalid", () => {
    for (const maxHorizonDays of [0, -5, 1.5, "30"]) {
      const result = evaluate(
        [policy({ id: "comp_far", effectiveDate: "2026-10-15" })],
        { maxHorizonDays: maxHorizonDays as number },
      );

      expect(result.warnings[0].id).toBe("invalid-scheduling-horizon");
      expect(result.warnings[0].message).toContain(
        `${DEFAULT_COMPENSATION_HORIZON_DAYS} day`,
      );
      // The advisory itself downgrades the status, but never blocks scheduling.
      expect(result.status).toBe("warning");
      expect(result.canScheduleCompensationChanges).toBe(true);
    }
  });

  it("does not raise a horizon advisory for superseded revisions", () => {
    const result = evaluate([
      policy({
        id: "comp_old",
        effectiveDate: "2099-01-01",
        status: "superseded",
      }),
    ]);

    expect(result.status).toBe("valid");
    expect(result.warnings).toHaveLength(0);
  });

  it("ranks a blocking problem above a horizon advisory", () => {
    const result = evaluate([
      policy({ id: "comp_far", effectiveDate: "2028-10-15" }),
      policy({ id: "comp_bad", effectiveDate: "2020-01-01" }),
    ]);

    expect(result.status).toBe("invalid");
    expect(result.canScheduleCompensationChanges).toBe(false);
    expect(result.checks[0].severity).toBe("error");
  });
});

describe("evaluateCompensationPolicyEffectiveDate — summary and remediation", () => {
  it("summarizes a healthy schedule and the next effective date", () => {
    const result = evaluate([
      policy({ id: "comp_next", effectiveDate: "2026-10-15" }),
    ]);

    expect(result.summaryMessage).toContain("All 1 policy have");
    expect(result.summaryMessage).toContain("1 policy have");
  });

  it("pluralizes the policy count", () => {
    const result = evaluate([
      policy({ id: "comp_a", effectiveDate: "2026-10-15" }),
      policy({ id: "comp_b", effectiveDate: "2026-11-15" }),
    ]);

    expect(result.summaryMessage).toContain("All 2 policies have");
  });

  it("says the change takes effect today when it is the reference date", () => {
    const result = evaluate([
      policy({ id: "comp_next", effectiveDate: REFERENCE_DATE }),
    ]);

    expect(result.summaryMessage).toContain(
      `takes effect today (${REFERENCE_DATE})`,
    );
  });

  it("reports that no future change is scheduled when all dates have passed", () => {
    const result = evaluate([
      policy({ id: "comp_current", effectiveDate: "2026-01-01", status: "active" }),
    ]);

    expect(result.summaryMessage).toContain("No future compensation change");
  });

  it("counts problems and links to the policy editor when blocking", () => {
    const result = evaluate([policy({ id: "comp_bad", effectiveDate: "nope" })]);

    expect(result.summaryMessage).toContain("cannot be scheduled");
    expect(result.summaryMessage).toContain("1 effective-date problem");
    expect(result.summaryMessage).toContain("/settings/payroll-policy");
  });

  it("reports advisories without blocking in the warning summary", () => {
    const result = evaluate([
      policy({ id: "comp_far", effectiveDate: "2028-10-15" }),
    ]);

    expect(result.summaryMessage).toContain("can be scheduled");
    expect(result.summaryMessage).toContain("1 advisory need review");
  });

  it("honours a custom remediation action", () => {
    const result = evaluateCompensationPolicyEffectiveDate([], {
      referenceDate: REFERENCE_DATE,
      remediationAction: { label: "Open policy", href: "/custom/policy" },
    });

    expect(result.remediationAction).toEqual({
      label: "Open policy",
      href: "/custom/policy",
    });
    expect(result.errors[0].remediation).toContain("/custom/policy");
    expect(result.summaryMessage).toContain("/custom/policy");
  });

  it("puts errors before warnings in the flat check list", () => {
    const result = evaluate([
      policy({ id: "comp_far", effectiveDate: "2028-10-15" }),
      policy({ id: "comp_bad", effectiveDate: "nope" }),
    ]);

    const severities = result.checks.map((check) => check.severity);
    expect(severities).toEqual(["error", "warning"]);
  });
});

describe("assertCompensationPolicyEffectiveDate", () => {
  it("does not throw for a valid schedule", () => {
    expect(() => {
      assertCompensationPolicyEffectiveDate(
        [policy({ id: "comp_next", effectiveDate: "2026-10-15" })],
        { referenceDate: REFERENCE_DATE },
      );
    }).not.toThrow();
  });

  it("does not throw for a schedule that only has advisories", () => {
    expect(() => {
      assertCompensationPolicyEffectiveDate(
        [policy({ id: "comp_far", effectiveDate: "2028-10-15" })],
        { referenceDate: REFERENCE_DATE },
      );
    }).not.toThrow();
  });

  it("throws with the full result attached when a date is unusable", () => {
    let thrown: unknown;
    try {
      assertCompensationPolicyEffectiveDate(
        [policy({ id: "comp_backdated", effectiveDate: "2026-09-01" })],
        { referenceDate: REFERENCE_DATE },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CompensationPolicyEffectiveDateError);
    const error = thrown as CompensationPolicyEffectiveDateError;
    expect(error.name).toBe("CompensationPolicyEffectiveDateError");
    expect(error.message).toBe(error.result.summaryMessage);
    expect(error.result.status).toBe("invalid");
    expect(error.result.canScheduleCompensationChanges).toBe(false);
    expect(error.result.errors.map((e) => e.id)).toEqual([
      "effective-date-in-past",
    ]);
  });
});

describe("privacy guarantees", () => {
  it("never echoes compensation amounts or employee data in results", () => {
    const result = evaluate([
      policy({ id: "comp_bad", effectiveDate: "2026-02-30" }),
      policy({ id: "comp_past", effectiveDate: "2020-01-01" }),
      policy({ id: "comp_far", effectiveDate: "2090-01-01" }),
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(
      /salary|amount|balance|wallet|secret|emp_|private key/i,
    );
  });

  it("keeps every finding limited to a date, an id, and a policy window", () => {
    const result = evaluate([
      policy({ id: "comp_a", effectiveDate: "2026-10-15" }),
      policy({ id: "comp_b", effectiveDate: "2026-10-15" }),
    ]);

    for (const check of result.checks) {
      expect(check.title.length).toBeGreaterThan(0);
      expect(check.message).toMatch(/comp_[ab]|2026-10-15/);
    }
  });
});
