import { describe, expect, it } from "vitest";
import { MOCK_AUDIT_GRANTS } from "@/app/audit/page";
import { MOCK_ARCHIVED_RUNS, type ArchivedPayrollRun } from "@/stores/archive";
import {
  evaluateAuditorArchivedPeriodAccess,
  maskTransactionHash,
} from "@/lib/audit/archivedPeriodAccess";

const ACTIVE_GRANT = MOCK_AUDIT_GRANTS[0]; // grant_audit_991823 (active, expires 2026-12-01)
const REVOKED_GRANT = MOCK_AUDIT_GRANTS[1]; // grant_audit_882041 (revoked)
const NO_READ_SCOPE_GRANT = MOCK_AUDIT_GRANTS[2]; // grant_audit_773912 (only VERIFY_ZK_PROOFS, also revoked)
const NOW = new Date("2026-10-10T12:00:00Z");

describe("evaluateAuditorArchivedPeriodAccess (#858)", () => {
  it("allows an authorized auditor with an active grant to view eligible archived periods", () => {
    const result = evaluateAuditorArchivedPeriodAccess({
      role: "auditor",
      grant: ACTIVE_GRANT,
      runs: MOCK_ARCHIVED_RUNS,
      now: NOW,
    });

    expect(result.allowed).toBe(true);
    expect(result.periods.map((p) => p.id)).toEqual(["arc_003", "arc_002", "arc_001"]);
    for (const period of result.periods) {
      expect(period.compensationDisplay).toBe("REDACTED_ZK");
      expect(JSON.stringify(period)).not.toContain("9500");
      expect(JSON.stringify(period)).not.toContain("21700");
    }
  });

  it("supports filtering archived auditor views to a specific payPeriod boundary", () => {
    const result = evaluateAuditorArchivedPeriodAccess({
      role: "auditor",
      grant: ACTIVE_GRANT,
      runs: MOCK_ARCHIVED_RUNS,
      now: NOW,
      payPeriodFilter: "2025-02",
    });

    expect(result.allowed).toBe(true);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].id).toBe("arc_002");
  });

  it("rejects unauthorized roles, missing grants, revoked grants, expired grants, and missing read scope", () => {
    const operatorDenied = evaluateAuditorArchivedPeriodAccess({
      role: "operator",
      grant: ACTIVE_GRANT,
      runs: MOCK_ARCHIVED_RUNS,
      now: NOW,
    });
    expect(operatorDenied.allowed).toBe(false);
    expect(operatorDenied.issues.map((i) => i.code)).toContain("unauthorized_role");

    const missingGrant = evaluateAuditorArchivedPeriodAccess({
      role: "auditor",
      grant: null,
      runs: MOCK_ARCHIVED_RUNS,
      now: NOW,
    });
    expect(missingGrant.allowed).toBe(false);
    expect(missingGrant.issues.map((i) => i.code)).toEqual(["missing_grant"]);

    const revoked = evaluateAuditorArchivedPeriodAccess({
      role: "auditor",
      grant: REVOKED_GRANT,
      runs: MOCK_ARCHIVED_RUNS,
      now: NOW,
    });
    expect(revoked.allowed).toBe(false);
    expect(revoked.issues.map((i) => i.code)).toContain("grant_revoked");

    const expiredAtBoundary = evaluateAuditorArchivedPeriodAccess({
      role: "auditor",
      grant: ACTIVE_GRANT,
      runs: MOCK_ARCHIVED_RUNS,
      now: new Date(ACTIVE_GRANT.expiresAt), // exact expiry timestamp boundary
    });
    expect(expiredAtBoundary.allowed).toBe(false);
    expect(expiredAtBoundary.issues.map((i) => i.code)).toContain("grant_expired");

    const activeWithoutReadScope = {
      ...NO_READ_SCOPE_GRANT,
      status: "active" as const,
      revokedAt: undefined,
      expiresAt: "2026-12-31T00:00:00Z",
    };
    const missingScope = evaluateAuditorArchivedPeriodAccess({
      role: "auditor",
      grant: activeWithoutReadScope,
      runs: MOCK_ARCHIVED_RUNS,
      now: NOW,
    });
    expect(missingScope.allowed).toBe(false);
    expect(missingScope.issues.map((i) => i.code)).toContain("missing_read_scope");
  });

  it("withholds disputed, unarchived, or bundle-unavailable runs with actionable non-leaking issues", () => {
    const unarchivedRun: ArchivedPayrollRun = {
      ...MOCK_ARCHIVED_RUNS[0],
      id: "arc_open",
      payPeriod: "2026-10",
      isArchived: false,
      totalAmount: 99999,
      notes: "Secret executive bonus note",
    };

    const result = evaluateAuditorArchivedPeriodAccess({
      role: "auditor",
      grant: ACTIVE_GRANT,
      runs: [...MOCK_ARCHIVED_RUNS, unarchivedRun],
      now: NOW,
    });

    expect(result.allowed).toBe(true);
    const issueCodes = result.issues.map((i) => i.code);
    expect(issueCodes).toContain("period_not_archived");
    expect(issueCodes).toContain("period_disputed");
    expect(issueCodes).toContain("audit_bundle_unavailable");

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("99999");
    expect(serialized).not.toContain("Secret executive bonus note");
    expect(serialized).not.toContain("14200");
    expect(serialized).not.toContain("18500");
  });

  it("masks transaction hashes deterministically", () => {
    expect(maskTransactionHash("def789ghi01234567890abcdef")).toBe("def789…cdef");
    expect(maskTransactionHash("short_hash")).toBe("short_hash");
  });
});
