import { describe, expect, it } from "vitest";
import {
  verifyDashboardAuditEventSequence,
  type DashboardAuditSequenceVerificationResult,
  type DashboardAuditSequenceProblem,
} from "@/src/audit/dashboardAuditEventSequenceVerification";
import type { AuditActivityEntry, AuditActionType } from "@/stores/auditActivity";

function makeEntry(overrides: Partial<AuditActivityEntry> & {
  id: string;
  action: AuditActionType;
  actor: string;
  targetName: string;
  timestamp: string;
  summary: string;
}): AuditActivityEntry {
  return {
    id: overrides.id,
    action: overrides.action,
    actor: overrides.actor,
    actorOrg: overrides.actorOrg,
    targetName: overrides.targetName,
    targetOrg: overrides.targetOrg,
    scope: overrides.scope,
    timestamp: overrides.timestamp,
    summary: overrides.summary,
  };
}

describe("verifyDashboardAuditEventSequence", () => {
  it("returns a valid result for a well-ordered descending feed", () => {
    // Default descending sort: later timestamps first, then smaller ids first
    // within the same timestamp.
    const entries = [
      makeEntry({
        id: "c-three",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor A",
        timestamp: "2026-08-30T12:00:00Z",
        summary: "Later event",
      }),
      makeEntry({
        id: "b-two",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor B",
        timestamp: "2026-08-30T11:00:00Z",
        summary: "Middle event",
      }),
      makeEntry({
        id: "a-one",
        action: "request_approved",
        actor: "Admin",
        targetName: "Auditor C",
        timestamp: "2026-08-30T10:00:00Z",
        summary: "Earlier event",
      }),
    ];

    const result: DashboardAuditSequenceVerificationResult = verifyDashboardAuditEventSequence(
      entries,
      "descending",
    );

    expect(result.status).toBe("valid");
    expect(result.problems).toHaveLength(0);
    expect(result.entryCount).toBe(3);
    expect(result.summary).toContain("3 entries");
    expect(result.summary).toContain("descending");
  });

  it("returns a valid result for a well-ordered ascending feed", () => {
    // Default ascending sort: earlier timestamps first, then smaller ids first.
    const entries = [
      makeEntry({
        id: "a-one",
        action: "request_approved",
        actor: "Admin",
        targetName: "Auditor C",
        timestamp: "2026-08-30T10:00:00Z",
        summary: "Earlier event",
      }),
      makeEntry({
        id: "b-two",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor B",
        timestamp: "2026-08-30T11:00:00Z",
        summary: "Middle event",
      }),
      makeEntry({
        id: "c-three",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor A",
        timestamp: "2026-08-30T12:00:00Z",
        summary: "Later event",
      }),
    ];

    const result = verifyDashboardAuditEventSequence(entries, "ascending");

    expect(result.status).toBe("valid");
    expect(result.problems).toHaveLength(0);
  });

  it("flags a single-entry feed as not-yet-verifiable", () => {
    const entries = [
      makeEntry({
        id: "only",
        action: "employer_onboarded",
        actor: "Admin",
        targetName: "Acme Corp",
        timestamp: "2026-08-30T10:00:00Z",
        summary: "Onboarding event",
      }),
    ];

    const result = verifyDashboardAuditEventSequence(entries);

    expect(result.status).toBe("invalid");
    expect(result.entryCount).toBe(1);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].code).toBe("single_entry_ignored");
    expect(result.problems[0].recommendedAction).toBeTruthy();
  });

  it("returns an actionable invalid result for an empty feed", () => {
    const result = verifyDashboardAuditEventSequence([]);

    expect(result.status).toBe("invalid");
    expect(result.entryCount).toBe(0);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].code).toBe("empty_feed");
    expect(result.problems[0].recommendedAction).toBeTruthy();
    // Privacy: message should not expose employee/salary data (not applicable here,
    // but verified structurally)
    expect(result.problems[0].message).not.toMatch(/salary|amount|wallet|ssn|email/i);
  });

  it("detects out-of-order timestamps in descending order", () => {
    const entries = [
      makeEntry({
        id: "b-earlier-ts",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor A",
        timestamp: "2026-08-30T10:00:00Z",
        summary: "Earlier timestamp",
      }),
      makeEntry({
        id: "a-later-ts",
        action: "key_revoked",
        actor: "Admin",
        targetName: "Auditor B",
        timestamp: "2026-08-30T12:00:00Z",
        summary: "Later timestamp",
      }),
    ];

    // Inline probe: print the order the verifier's sort would produce.
    // eslint-disable-next-line no-console
    console.log(
      "[probe] descOrder:",
      [...entries].sort((a, b) => {
        const at = new Date(a.timestamp).getTime();
        const bt = new Date(b.timestamp).getTime();
        if (at !== bt) return bt - at;
        return String(a.id).localeCompare(String(b.id));
      }).map((e) => `${e.id} @ ${e.timestamp}`),
    );

    const result = verifyDashboardAuditEventSequence(entries, "descending");

    expect(result.status).toBe("invalid");
    expect(result.problems.some((p) => p.code === "out_of_order_timestamp")).toBe(true);
    expect(result.problems.every((p) => p.recommendedAction !== undefined)).toBe(true);
  });

  it("detects out-of-order timestamps in descending order (larger-later-id variant)", () => {
    // Second variant: later timestamp has the larger id, so it should appear
    // first in a well-ordered descending feed.
    const entries = [
      makeEntry({
        id: "a-earlier-ts",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor A",
        timestamp: "2026-08-30T10:00:00Z",
        summary: "Earlier timestamp",
      }),
      makeEntry({
        id: "z-later-ts",
        action: "key_revoked",
        actor: "Admin",
        targetName: "Auditor B",
        timestamp: "2026-08-30T12:00:00Z",
        summary: "Later timestamp",
      }),
    ];

    // Inline probe: print the order the verifier's sort would produce.
    // eslint-disable-next-line no-console
    console.log(
      "[probe] descOrder2:",
      [...entries].sort((a, b) => {
        const at = new Date(a.timestamp).getTime();
        const bt = new Date(b.timestamp).getTime();
        if (at !== bt) return bt - at;
        return String(a.id).localeCompare(String(b.id));
      }).map((e) => `${e.id} @ ${e.timestamp}`),
    );

    const result = verifyDashboardAuditEventSequence(entries, "descending");

    expect(result.status).toBe("invalid");
    expect(result.problems.some((p) => p.code === "out_of_order_timestamp")).toBe(true);
    expect(result.problems.every((p) => p.recommendedAction !== undefined)).toBe(true);
  });

  it("detects duplicate timestamps when content differs", () => {
    const entries = [
      makeEntry({
        id: "e1",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor A",
        timestamp: "2026-08-30T12:00:00Z",
        summary: "First meaning",
      }),
      makeEntry({
        id: "e2",
        action: "key_revoked",
        actor: "Admin",
        targetName: "Auditor B",
        timestamp: "2026-08-30T12:00:00Z",
        summary: "Second meaning",
      }),
    ];

    const result = verifyDashboardAuditEventSequence(entries, "ascending");

    expect(result.status).toBe("invalid");
    expect(result.problems.some((p) => p.code === "duplicate_timestamp")).toBe(true);
  });

  it("does not flag duplicate timestamps when content is effectively identical", () => {
    // Same timestamp to the millisecond and identical operational content;
    // ids differ but that is the only difference, so the verifier ignores it.
    const entries = [
      makeEntry({
        id: "dup-a",
        action: "key_granted",
        actor: "Admin",
        actorOrg: "ZK Payroll Inc.",
        targetName: "Auditor A",
        targetOrg: "Deloitte",
        scope: "full-audit",
        timestamp: "2026-08-30T12:00:00.000Z",
        summary: "Same meaning",
      }),
      makeEntry({
        id: "dup-b",
        action: "key_granted",
        actor: "Admin",
        actorOrg: "ZK Payroll Inc.",
        targetName: "Auditor A",
        targetOrg: "Deloitte",
        scope: "full-audit",
        timestamp: "2026-08-30T12:00:00Z",
        summary: "Same meaning",
      }),
    ];

    const result = verifyDashboardAuditEventSequence(entries, "ascending");

    expect(result.status).toBe("valid");
    expect(result.problems.some((p) => p.code === "duplicate_timestamp")).toBe(false);
  });

  it("reports unparseable timestamps in feed order", () => {
    const entries = [
      makeEntry({
        id: "b",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor B",
        timestamp: "2026-08-30T10:00:00Z",
        summary: "Valid timestamp",
      }),
      makeEntry({
        id: "a",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor A",
        timestamp: "bad-timestamp",
        summary: "Bad timestamp",
      }),
    ];

    const result = verifyDashboardAuditEventSequence(entries, "ascending");

    expect(result.status).toBe("invalid");
    expect(result.entryCount).toBe(2);
    // Unparseable timestamps are grouped last in id order for stable
    // ascending display; for ascending this means "b" then "a" still keeps
    // invalids last. The problem is reported at index 1.
    expect(result.problems.length).toBeGreaterThanOrEqual(1);
    expect(result.problems[0].code).toBe("unparseable_timestamp");
    expect(result.problems[0].index).toBe(1);
  });

  it("remains privacy-safe by never surfacing salary or wallet data in problems", () => {
    const entries = [
      makeEntry({
        id: "s1",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor A",
        timestamp: "2026-08-30T10:00:00Z",
        summary: "Full-audit view key granted for annual review of payroll disbursements.",
      }),
      makeEntry({
        id: "s2",
        action: "request_approved",
        actor: "Admin",
        targetName: "Auditor B",
        timestamp: "2026-08-30T11:00:00Z",
        summary: "Audit access request approved. View key issued for reconciliation review.",
      }),
    ];

    const result = verifyDashboardAuditEventSequence(entries);

    const combined = [
      result.summary,
      ...result.problems.map((p) => p.message),
      ...result.problems.map((p) => p.recommendedAction ?? ""),
    ]
      .filter(Boolean)
      .join("\n");

    expect(combined).not.toMatch(/\$[\d,]+/);
    expect(combined).not.toMatch(/G[A-Z0-9]{10,}/);
    expect(combined).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
  });

  it("edge case: preserves index guidance so the dashboard can highlight the offending row", () => {
    const entries = [
      makeEntry({
        id: "b-earlier-ts",
        action: "key_granted",
        actor: "Admin",
        targetName: "Auditor A",
        timestamp: "2026-08-30T10:00:00Z",
        summary: "Earlier timestamp",
      }),
      makeEntry({
        id: "a-later-ts",
        action: "key_revoked",
        actor: "Admin",
        targetName: "Auditor B",
        timestamp: "2026-08-30T12:00:00Z",
        summary: "Later timestamp",
      }),
    ];

    const result = verifyDashboardAuditEventSequence(entries, "descending");

    expect(result.status).toBe("invalid");
    const timestampProblem = result.problems.find((p) => p.code === "out_of_order_timestamp");
    expect(timestampProblem).toBeDefined();
    expect(timestampProblem?.index).toBe(1);
  });

  it("handles equal timestamps with different millisecond precision that parse equally", () => {
    // Identical operational content + timestamps that resolve to the same
    // millisecond are treated as non-duplicate.
    const entries = [
      makeEntry({
        id: "p1",
        action: "key_granted",
        actor: "Admin",
        actorOrg: "ZK Payroll Inc.",
        targetName: "Auditor A",
        targetOrg: "Deloitte",
        scope: "full-audit",
        timestamp: "2026-08-30T12:00:00.000Z",
        summary: "Same meaning",
      }),
      makeEntry({
        id: "p2",
        action: "key_granted",
        actor: "Admin",
        actorOrg: "ZK Payroll Inc.",
        targetName: "Auditor A",
        targetOrg: "Deloitte",
        scope: "full-audit",
        timestamp: "2026-08-30T12:00:00Z",
        summary: "Same meaning",
      }),
    ];

    const result = verifyDashboardAuditEventSequence(entries, "ascending");

    expect(result.status).toBe("valid");
    expect(result.problems.some((p) => p.code === "duplicate_timestamp")).toBe(false);
  });
});
