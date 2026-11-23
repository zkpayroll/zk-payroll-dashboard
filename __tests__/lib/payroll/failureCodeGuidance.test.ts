import { describe, expect, it } from "vitest";
import {
  getPayrollFailureGuidance,
  getFailureGuidanceByArea,
  getAllFailureGuidances,
  PAYROLL_FAILURE_REGISTRY,
} from "@/lib/payroll/failureCodeGuidance";

describe("failureCodeGuidance", () => {
  describe("getPayrollFailureGuidance", () => {
    it("returns guidance for duplicate commitment error", () => {
      const guidance = getPayrollFailureGuidance(
        "IMPORT_DUPLICATE_COMMITMENT",
      );
      expect(guidance).not.toBeNull();
      expect(guidance?.title).toMatch(/duplicate/i);
      expect(guidance?.severity).toBe("error");
      expect(guidance?.affectedArea).toBe("import");
    });

    it("returns guidance for segregation of duties violation", () => {
      const guidance = getPayrollFailureGuidance(
        "SEGREGATION_DUTY_VIOLATION",
      );
      expect(guidance).not.toBeNull();
      expect(guidance?.title).toMatch(/segregation/i);
      expect(guidance?.severity).toBe("critical");
    });

    it("returns guidance for audit schema version mismatch", () => {
      const guidance = getPayrollFailureGuidance(
        "AUDIT_SCHEMA_VERSION_MISMATCH",
      );
      expect(guidance).not.toBeNull();
      expect(guidance?.title).toMatch(/schema/i);
      expect(guidance?.severity).toBe("warning");
      expect(guidance?.affectedArea).toBe("audit");
    });

    it("returns guidance for treasury insufficient funds", () => {
      const guidance = getPayrollFailureGuidance("TREASURY_INSUFFICIENT_FUNDS");
      expect(guidance).not.toBeNull();
      expect(guidance?.title).toMatch(/insufficient/i);
      expect(guidance?.severity).toBe("critical");
      expect(guidance?.affectedArea).toBe("execution");
    });

    it("returns null for unknown failure code", () => {
      const guidance = getPayrollFailureGuidance("UNKNOWN_CODE");
      expect(guidance).toBeNull();
    });
  });

  describe("getFailureGuidanceByArea", () => {
    it("returns all import-related failures", () => {
      const failures = getFailureGuidanceByArea("import");
      expect(failures.length).toBeGreaterThan(0);
      failures.forEach((f) => {
        expect(f.affectedArea).toBe("import");
      });
    });

    it("returns all validation-related failures", () => {
      const failures = getFailureGuidanceByArea("validation");
      expect(failures.length).toBeGreaterThan(0);
      failures.forEach((f) => {
        expect(f.affectedArea).toBe("validation");
      });
    });

    it("returns all execution-related failures", () => {
      const failures = getFailureGuidanceByArea("execution");
      expect(failures.length).toBeGreaterThan(0);
      failures.forEach((f) => {
        expect(f.affectedArea).toBe("execution");
      });
    });

    it("returns all audit-related failures", () => {
      const failures = getFailureGuidanceByArea("audit");
      expect(failures.length).toBeGreaterThan(0);
      failures.forEach((f) => {
        expect(f.affectedArea).toBe("audit");
      });
    });

    it("returns empty array for unknown area", () => {
      const failures = getFailureGuidanceByArea("unknown" as never);
      expect(failures).toEqual([]);
    });
  });

  describe("getAllFailureGuidances", () => {
    it("returns all registered failure guidances", () => {
      const all = getAllFailureGuidances();
      expect(all.length).toBeGreaterThan(0);
      expect(all.length).toBe(Object.keys(PAYROLL_FAILURE_REGISTRY).length);
    });

    it("all guidances have required fields", () => {
      const all = getAllFailureGuidances();
      all.forEach((guidance) => {
        expect(guidance.code).toBeDefined();
        expect(guidance.title).toBeDefined();
        expect(guidance.severity).toBeDefined();
        expect(guidance.summary).toBeDefined();
        expect(guidance.userFacingMessage).toBeDefined();
        expect(Array.isArray(guidance.remediation)).toBe(true);
        expect(guidance.remediation.length).toBeGreaterThan(0);
        expect(guidance.affectedArea).toBeDefined();
      });
    });
  });

  describe("failure severity levels", () => {
    it("marks critical failures appropriately", () => {
      const critical = getAllFailureGuidances().filter(
        (f) => f.severity === "critical",
      );
      expect(critical.length).toBeGreaterThan(0);
      expect(
        critical.some((f) => f.code === "SEGREGATION_DUTY_VIOLATION"),
      ).toBe(true);
      expect(
        critical.some((f) => f.code === "TREASURY_INSUFFICIENT_FUNDS"),
      ).toBe(true);
    });

    it("marks errors appropriately", () => {
      const errors = getAllFailureGuidances().filter(
        (f) => f.severity === "error",
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((f) => f.code === "IMPORT_DUPLICATE_COMMITMENT"),
      ).toBe(true);
    });

    it("marks warnings appropriately", () => {
      const warnings = getAllFailureGuidances().filter(
        (f) => f.severity === "warning",
      );
      expect(warnings.length).toBeGreaterThan(0);
      expect(
        warnings.some((f) => f.code === "AUDIT_SCHEMA_VERSION_MISMATCH"),
      ).toBe(true);
    });
  });

  describe("remediation guidance", () => {
    it("provides actionable remediation steps", () => {
      const guidance = getPayrollFailureGuidance(
        "IMPORT_DUPLICATE_COMMITMENT",
      );
      expect(guidance?.remediation).toBeDefined();
      expect(guidance?.remediation.length).toBeGreaterThanOrEqual(2);
      guidance?.remediation.forEach((step) => {
        expect(typeof step).toBe("string");
        expect(step.length).toBeGreaterThan(0);
      });
    });

    it("user-facing messages are appropriate for different audiences", () => {
      const all = getAllFailureGuidances();
      all.forEach((guidance) => {
        expect(guidance.userFacingMessage).not.toMatch(/salary/i);
        expect(guidance.userFacingMessage).not.toMatch(/amount/i);
        expect(guidance.userFacingMessage.length).toBeGreaterThan(10);
      });
    });
  });

  describe("privacy safety", () => {
    it("never includes sensitive data in guidance", () => {
      const all = getAllFailureGuidances();
      all.forEach((guidance) => {
        const content = JSON.stringify(guidance);
        expect(content).not.toMatch(/\$|£|€|¥/);
        expect(content).not.toMatch(/@.*\./);
      });
    });

    it("masks references to salary in user messages", () => {
      const all = getAllFailureGuidances();
      all.forEach((guidance) => {
        expect(guidance.userFacingMessage).not.toMatch(/\d+\.\d+\.\d+/);
      });
    });
  });
});
