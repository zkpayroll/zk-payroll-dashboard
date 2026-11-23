import { describe, it, expect } from "vitest";
import {
  PROOF_REFERENCE_GUIDANCE,
  normalizeProofReference,
  validateProofReference,
} from "@/lib/validation/proofReference";

describe("validateProofReference", () => {
  describe("success", () => {
    it("accepts a canonical reference and reports no failure reason", () => {
      const result = validateProofReference("zkp_ref_20250228_001");
      expect(result.isValid).toBe(true);
      expect(result.message).toBeNull();
      expect(result.reason).toBeNull();
      expect(result.normalized).toBe("zkp_ref_20250228_001");
    });

    it("accepts a pasted reference with surrounding whitespace and a newline", () => {
      const result = validateProofReference("  zkp_ref_20250228_001\n");
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe("zkp_ref_20250228_001");
    });

    it("accepts an uppercase reference because it is normalized to lowercase", () => {
      expect(validateProofReference("ZKP_REF_20250228_001").isValid).toBe(true);
    });
  });

  describe("failure", () => {
    it("reports an empty value as required with reason empty", () => {
      const result = validateProofReference("   ");
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("empty");
      expect(result.message).toMatch(/^Proof reference is required\./);
    });

    it("reports a wrong prefix as malformed with actionable recovery text", () => {
      const result = validateProofReference("ref_20250228_001");
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("malformed");
      expect(result.message).toContain("zkp_ref_YYYYMMDD_NNN");
      expect(result.message).toContain("Re-copy the full reference");
    });

    it("rejects a reference missing the date segment", () => {
      expect(validateProofReference("zkp_ref_001").reason).toBe("malformed");
    });

    it("rejects a non-numeric date segment", () => {
      expect(validateProofReference("zkp_ref_2025-02-28_001").isValid).toBe(false);
    });

    it("never echoes the submitted value in the failure message", () => {
      const submitted = "zkp_ref_salary_12345.00_EMP-77";
      const result = validateProofReference(submitted);
      expect(result.isValid).toBe(false);
      expect(result.message).not.toContain(submitted);
      expect(result.message).not.toContain("12345");
      expect(result.message).not.toContain("EMP-77");
    });

    it("explains an unsupported proof format without exposing payroll data", () => {
      const submitted = "proof:groth16:salary=98000:EMP-42";
      const result = validateProofReference(submitted);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("malformed");
      expect(result.message).toContain("zkp_ref_YYYYMMDD_NNN");
      expect(result.message).not.toContain("98000");
      expect(result.message).not.toContain("EMP-42");
      expect(result.message).not.toContain("groth16");
    });
  });

  describe("boundaries", () => {
    it("accepts exactly 8 date digits and exactly 3 sequence digits", () => {
      expect(validateProofReference("zkp_ref_00000000_000").isValid).toBe(true);
    });

    it("rejects a 7-digit date segment", () => {
      expect(validateProofReference("zkp_ref_2025022_001").isValid).toBe(false);
    });

    it("rejects a 9-digit date segment", () => {
      expect(validateProofReference("zkp_ref_202502288_001").isValid).toBe(false);
    });

    it("rejects a sequence with only 2 digits", () => {
      expect(validateProofReference("zkp_ref_20250228_01").isValid).toBe(false);
    });

    it("accepts a sequence longer than 3 digits", () => {
      expect(validateProofReference("zkp_ref_20250228_0001").isValid).toBe(true);
    });

    it("rejects a trailing character after the sequence", () => {
      expect(validateProofReference("zkp_ref_20250228_001x").isValid).toBe(false);
    });

    it("strips embedded whitespace from a reference split across lines", () => {
      expect(normalizeProofReference("zkp_ref_2025\n0228_001")).toBe("zkp_ref_20250228_001");
    });
  });

  describe("guidance", () => {
    it("describes the valid shape, the example, and the recovery step", () => {
      expect(PROOF_REFERENCE_GUIDANCE).toContain("zkp_ref_YYYYMMDD_NNN");
      expect(PROOF_REFERENCE_GUIDANCE).toContain("zkp_ref_20250228_001");
      expect(PROOF_REFERENCE_GUIDANCE).toContain("Re-copy the full reference");
    });

    it("tells the operator not to enter payroll amounts or employee details", () => {
      expect(PROOF_REFERENCE_GUIDANCE).toContain("not payroll amounts or employee details");
    });
  });
});
