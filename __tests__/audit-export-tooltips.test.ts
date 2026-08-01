import { describe, it, expect } from "vitest";
import { resolveDisabledExportReason } from "@/components/features/compliance/AuditExportTooltips";
import type { ViewKey } from "@/types";
import type { UserRole } from "@/types/models";

const NOW = 1_700_000_000_000;

function viewKey(overrides: Partial<ViewKey> = {}): ViewKey {
  return {
    id: overrides.id ?? "vk_test",
    keyId: overrides.keyId ?? "vk_keyid1234abcd",
    auditorName: overrides.auditorName ?? "Auditor",
    auditorOrg: overrides.auditorOrg ?? "Org",
    scope: overrides.scope ?? "full-audit",
    grantedBy: overrides.grantedBy ?? "Admin",
    createdAt: overrides.createdAt ?? new Date(NOW - 1000).toISOString(),
    expiresAt:
      overrides.expiresAt ?? new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: overrides.isActive ?? true,
  };
}

const fullAuditKey = viewKey({ scope: "full-audit" });
const readOnlyKey = viewKey({ scope: "read-only" });
const expiredKey = viewKey({
  scope: "full-audit",
  expiresAt: new Date(NOW - 1000).toISOString(),
});

describe("resolveDisabledExportReason (#207)", () => {
  describe("admin role", () => {
    it("allows summary exports with a full-audit grant", () => {
      const reason = resolveDisabledExportReason({
        role: "admin" as UserRole,
        level: "summary",
        activeGrant: fullAuditKey,
        now: NOW,
      });
      expect(reason).toBeNull();
    });

    it("allows full-audit exports with an active full-audit grant", () => {
      const reason = resolveDisabledExportReason({
        role: "admin" as UserRole,
        level: "full",
        activeGrant: fullAuditKey,
        now: NOW,
      });
      expect(reason).toBeNull();
    });

    it("disables full exports for admins whose grant is read-only", () => {
      const reason = resolveDisabledExportReason({
        role: "admin" as UserRole,
        level: "full",
        activeGrant: readOnlyKey,
        now: NOW,
      });
      expect(reason?.code).toBe("grant_read_only");
      expect(reason?.message).not.toMatch(/vk_|0x[0-9a-f]+/i);
    });

    it("disables full exports for admins whose grant is expired", () => {
      const reason = resolveDisabledExportReason({
        role: "admin" as UserRole,
        level: "full",
        activeGrant: expiredKey,
        now: NOW,
      });
      expect(reason?.code).toBe("grant_expired");
    });
  });

  describe("auditor role", () => {
    it("disables exports when there is no active grant", () => {
      const reason = resolveDisabledExportReason({
        role: "auditor" as UserRole,
        level: "summary",
        activeGrant: null,
        now: NOW,
      });
      expect(reason?.code).toBe("no_active_grant");
    });

    it("allows summary exports with an active read-only grant", () => {
      const reason = resolveDisabledExportReason({
        role: "auditor" as UserRole,
        level: "summary",
        activeGrant: readOnlyKey,
        now: NOW,
      });
      expect(reason).toBeNull();
    });

    it("disables full exports when the auditor's grant is read-only", () => {
      const reason = resolveDisabledExportReason({
        role: "auditor" as UserRole,
        level: "full",
        activeGrant: readOnlyKey,
        now: NOW,
      });
      expect(reason?.code).toBe("grant_read_only");
    });

    it("disables exports when the auditor's grant has expired", () => {
      const reason = resolveDisabledExportReason({
        role: "auditor" as UserRole,
        level: "summary",
        activeGrant: expiredKey,
        now: NOW,
      });
      expect(reason?.code).toBe("grant_expired");
    });

    it("warns about expiring grants within the warning window", () => {
      const expiringKey = viewKey({
        expiresAt: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
      });
      const reason = resolveDisabledExportReason({
        role: "auditor" as UserRole,
        level: "summary",
        activeGrant: expiringKey,
        now: NOW,
      });
      expect(reason?.code).toBe("grant_expiring_soon");
    });
  });

  describe("operator role", () => {
    it("disables all audit exports for operators", () => {
      const reason = resolveDisabledExportReason({
        role: "operator" as UserRole,
        level: "summary",
        activeGrant: fullAuditKey,
        now: NOW,
      });
      expect(reason?.code).toBe("role_insufficient");
    });
  });

  describe("null role (demo mode)", () => {
    it("falls back to operator-style explanation when no role resolves", () => {
      const reason = resolveDisabledExportReason({
        role: null,
        level: "summary",
        activeGrant: null,
        now: NOW,
      });
      expect(reason?.code).toBe("role_insufficient");
    });
  });

  describe("tooltip safety (#207 constraint)", () => {
    it("never leaks key IDs into the tooltip text", () => {
      const reason = resolveDisabledExportReason({
        role: "auditor" as UserRole,
        level: "full",
        activeGrant: readOnlyKey,
        now: NOW,
      });
      expect(reason?.message).not.toContain("vk_keyid1234abcd");
      expect(reason?.message).not.toContain("vk_test");
    });

    it("never leaks full recipient addresses or grant IDs into the tooltip text", () => {
      const reason = resolveDisabledExportReason({
        role: "auditor" as UserRole,
        level: "summary",
        activeGrant: expiredKey,
        now: NOW,
      });
      expect(reason?.message).toBeDefined();
      expect(reason!.message).not.toMatch(/G[A-Z0-9]{30,}/);
      expect(reason!.message).not.toMatch(/vk_[a-z0-9]+/);
    });
  });
});