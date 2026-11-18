/**
 * Tests for parent-role expiry of delegated approvals (#778). Covers the
 * successful case (parent outlives the approval: no warning), the rejected
 * case (parent revoked: approval already expired), and boundary cases
 * (parent expiring exactly with, just before, and just after the approval).
 */
import { describe, it, expect } from "vitest";
import {
  resolveDelegatedApprovalParentExpiry,
  type ParentRoleGrant,
} from "@/lib/payroll/delegatedApprovalExpiry";

const NOW = new Date("2026-09-20T10:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

describe("resolveDelegatedApprovalParentExpiry", () => {
  it("raises no warning when the parent role outlives the approval (success case)", () => {
    const parent: ParentRoleGrant = {
      roleLabel: "Admin",
      expiresAt: iso(48 * HOUR),
    };

    const result = resolveDelegatedApprovalParentExpiry(iso(24 * HOUR), parent, NOW);

    expect(result.status).toBe("ok");
    expect(result.expired).toBe(false);
    expect(result.warningCode).toBeNull();
    expect(result.warningMessage).toBeNull();
    expect(result.effectiveExpiresAt).toBe(iso(24 * HOUR));
  });

  it("warns when the parent role expires before the approval's own window", () => {
    const parent: ParentRoleGrant = {
      roleLabel: "Admin",
      expiresAt: iso(2 * HOUR),
    };

    const result = resolveDelegatedApprovalParentExpiry(iso(24 * HOUR), parent, NOW);

    expect(result.status).toBe("expires_with_parent");
    expect(result.expired).toBe(false);
    expect(result.warningCode).toBe(
      "DELEGATED_APPROVAL_EXPIRES_WITH_PARENT_ROLE",
    );
    expect(result.warningMessage).toMatch(/expires with its parent role/);
    expect(result.warningMessage).toMatch(/Admin/);
    expect(result.effectiveExpiresAt).toBe(iso(2 * HOUR));
  });

  it("treats the approval as expired once the parent role's earlier expiry passes", () => {
    const parent: ParentRoleGrant = {
      roleLabel: "Admin",
      expiresAt: iso(2 * HOUR),
    };

    const result = resolveDelegatedApprovalParentExpiry(
      iso(24 * HOUR),
      parent,
      NOW + 3 * HOUR,
    );

    expect(result.status).toBe("expires_with_parent");
    expect(result.expired).toBe(true);
    expect(result.warningCode).toBe(
      "DELEGATED_APPROVAL_EXPIRES_WITH_PARENT_ROLE",
    );
  });

  it("treats the approval as expired when the parent role was revoked (rejected case)", () => {
    const parent: ParentRoleGrant = {
      roleLabel: "Admin",
      expiresAt: iso(48 * HOUR),
      revoked: true,
      revokedAt: iso(1 * HOUR),
    };

    const result = resolveDelegatedApprovalParentExpiry(iso(24 * HOUR), parent, NOW);

    expect(result.status).toBe("expired_with_parent");
    expect(result.expired).toBe(true);
    expect(result.warningCode).toBe(
      "DELEGATED_APPROVAL_PARENT_ROLE_REVOKED",
    );
    expect(result.warningMessage).toMatch(/was revoked/);
    expect(result.warningMessage).toMatch(/Admin/);
    expect(result.effectiveExpiresAt).toBe(iso(1 * HOUR));
  });

  it("warns when the parent role expires exactly at the approval's own expiry (boundary)", () => {
    const parent: ParentRoleGrant = {
      roleLabel: "Operator",
      expiresAt: iso(24 * HOUR),
    };

    const result = resolveDelegatedApprovalParentExpiry(iso(24 * HOUR), parent, NOW);

    expect(result.status).toBe("expires_with_parent");
    expect(result.warningCode).toBe(
      "DELEGATED_APPROVAL_EXPIRES_WITH_PARENT_ROLE",
    );
  });

  it("raises no warning when no parent role is recorded (fail-open)", () => {
    const result = resolveDelegatedApprovalParentExpiry(iso(24 * HOUR), null, NOW);

    expect(result.status).toBe("ok");
    expect(result.warningCode).toBeNull();
    expect(result.expired).toBe(false);
    expect(result.effectiveExpiresAt).toBe(iso(24 * HOUR));
  });

  it("raises no warning when the parent expiry is missing or unparseable (fail-open)", () => {
    const noExpiry = resolveDelegatedApprovalParentExpiry(
      iso(24 * HOUR),
      { roleLabel: "Admin" },
      NOW,
    );
    expect(noExpiry.status).toBe("ok");
    expect(noExpiry.warningCode).toBeNull();

    const badExpiry = resolveDelegatedApprovalParentExpiry(
      iso(24 * HOUR),
      { roleLabel: "Admin", expiresAt: "not-a-date" },
      NOW,
    );
    expect(badExpiry.status).toBe("ok");
    expect(badExpiry.warningCode).toBeNull();
  });

  it("never exposes payroll amounts or employee data in warning text", () => {
    const parent: ParentRoleGrant = {
      roleLabel: "Admin",
      expiresAt: iso(2 * HOUR),
    };

    const result = resolveDelegatedApprovalParentExpiry(iso(24 * HOUR), parent, NOW);

    expect(result.warningMessage).not.toMatch(/salary|employee|amount|\$/i);
  });
});
