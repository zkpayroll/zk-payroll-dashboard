import { describe, expect, it } from "vitest";
import {
  getEventSchemaVersions,
  getCurrentSchemaVersion,
  isSchemaVersionSupported,
  getSchemaVersionCompatibility,
  validateEventSchemaVersion,
  type AuditEventType,
} from "@/lib/audit/eventSchemaVersioning";

describe("eventSchemaVersioning", () => {
  describe("getEventSchemaVersions", () => {
    it("returns versions for payroll_run event type", () => {
      const versions = getEventSchemaVersions("payroll_run");
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].version).toBeDefined();
    });

    it("returns versions for payroll_approval event type", () => {
      const versions = getEventSchemaVersions("payroll_approval");
      expect(versions.length).toBeGreaterThan(0);
    });

    it("returns versions for settlement_transaction event type", () => {
      const versions = getEventSchemaVersions("settlement_transaction");
      expect(versions.length).toBeGreaterThan(0);
    });

    it("returns versions for audit_access_grant event type", () => {
      const versions = getEventSchemaVersions("audit_access_grant");
      expect(versions.length).toBeGreaterThan(0);
    });

    it("returns empty array for unknown event type", () => {
      const versions = getEventSchemaVersions("unknown_type" as AuditEventType);
      expect(versions).toEqual([]);
    });
  });

  describe("getCurrentSchemaVersion", () => {
    it("returns latest version for payroll_run", () => {
      const current = getCurrentSchemaVersion("payroll_run");
      expect(current).not.toBeNull();
      expect(current?.version).toBe("2.0.0");
    });

    it("returns latest version for payroll_approval", () => {
      const current = getCurrentSchemaVersion("payroll_approval");
      expect(current).not.toBeNull();
      expect(current?.version).toBe("1.1.0");
    });

    it("returns null for unknown event type", () => {
      const current = getCurrentSchemaVersion(
        "unknown_type" as AuditEventType,
      );
      expect(current).toBeNull();
    });

    it("current version has description", () => {
      const current = getCurrentSchemaVersion("payroll_run");
      expect(current?.description).toBeDefined();
      expect(current?.description?.length).toBeGreaterThan(0);
    });
  });

  describe("isSchemaVersionSupported", () => {
    it("confirms support for existing versions", () => {
      expect(isSchemaVersionSupported("payroll_run", "1.0.0")).toBe(true);
      expect(isSchemaVersionSupported("payroll_run", "2.0.0")).toBe(true);
    });

    it("rejects unsupported versions", () => {
      expect(isSchemaVersionSupported("payroll_run", "3.0.0")).toBe(false);
      expect(isSchemaVersionSupported("payroll_run", "0.1.0")).toBe(false);
    });

    it("returns false for unknown event types", () => {
      expect(isSchemaVersionSupported("unknown_type" as AuditEventType, "1.0.0")).toBe(false);
    });
  });

  describe("getSchemaVersionCompatibility", () => {
    it("returns compatibility list for version 1.0.0 payroll_run", () => {
      const compat = getSchemaVersionCompatibility("payroll_run", "1.0.0");
      expect(compat).toContain("1.0.0");
    });

    it("returns compatibility list for version 2.0.0 payroll_run", () => {
      const compat = getSchemaVersionCompatibility("payroll_run", "2.0.0");
      expect(compat).toContain("1.0.0");
      expect(compat).toContain("2.0.0");
    });

    it("returns compatibility for payroll_approval 1.1.0", () => {
      const compat = getSchemaVersionCompatibility("payroll_approval", "1.1.0");
      expect(compat).toContain("1.0.0");
      expect(compat).toContain("1.1.0");
    });

    it("returns empty array for unsupported version", () => {
      const compat = getSchemaVersionCompatibility("payroll_run", "9.9.9");
      expect(compat).toEqual([]);
    });
  });

  describe("validateEventSchemaVersion", () => {
    it("validates supported versions", () => {
      const result = validateEventSchemaVersion("payroll_run", "1.0.0");
      expect(result.valid).toBe(true);
      expect(result.message).toMatch(/valid/i);
    });

    it("validates latest versions", () => {
      const result = validateEventSchemaVersion("payroll_run", "2.0.0");
      expect(result.valid).toBe(true);
    });

    it("rejects unsupported versions with helpful message", () => {
      const result = validateEventSchemaVersion("payroll_run", "9.9.9");
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/unsupported/i);
      expect(result.message).toMatch(/1\.0\.0.*2\.0\.0/);
    });

    it("rejects versions for unknown event types", () => {
      const result = validateEventSchemaVersion(
        "unknown_event" as AuditEventType,
        "1.0.0",
      );
      expect(result.valid).toBe(false);
    });

    it("includes supported versions in error message", () => {
      const result = validateEventSchemaVersion("payroll_approval", "5.0.0");
      expect(result.message).toMatch(/1\.0\.0.*1\.1\.0/);
    });
  });

  describe("schema version evolution", () => {
    it("newer versions include compatibility with older versions", () => {
      const v1 = getSchemaVersionCompatibility("payroll_run", "1.0.0");
      const v2 = getSchemaVersionCompatibility("payroll_run", "2.0.0");

      expect(v1).toContain("1.0.0");
      expect(v2).toContain("1.0.0");
      expect(v2.length).toBeGreaterThanOrEqual(v1.length);
    });

    it("event types have release dates", () => {
      const versions = getEventSchemaVersions("payroll_run");
      versions.forEach((v) => {
        expect(v.releaseDate).toBeDefined();
        expect(v.releaseDate.match(/\d{4}-\d{2}-\d{2}/)).not.toBeNull();
      });
    });

    it("versions have descriptions for changelog", () => {
      const versions = getEventSchemaVersions("payroll_approval");
      versions.forEach((v) => {
        expect(v.description).toBeDefined();
        expect(v.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe("multi-version exports", () => {
    it("validates multiple events with different schema versions", () => {
      const eventTypes: AuditEventType[] = [
        "payroll_run",
        "payroll_approval",
        "settlement_transaction",
      ];

      eventTypes.forEach((type) => {
        const isValid = isSchemaVersionSupported(type, "1.0.0");
        expect(typeof isValid).toBe("boolean");
      });
    });

    it("handles audit_access_grant schema evolution", () => {
      const v1 = isSchemaVersionSupported("audit_access_grant", "1.0.0");
      const v1_1 = isSchemaVersionSupported("audit_access_grant", "1.1.0");
      expect(v1).toBe(true);
      expect(v1_1).toBe(true);
    });
  });
});
