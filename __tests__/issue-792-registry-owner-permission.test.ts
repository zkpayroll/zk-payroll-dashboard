import { describe, it, expect } from "vitest";
import {
  getPayrollFailureGuidance,
  PAYROLL_FAILURE_REGISTRY,
} from "@/lib/payroll/failureCodeGuidance";

/**
 * #792 — Registry owner permission failures must be explained in the payout
 * review surface with actionable remediation that does not leak the owner
 * wallet or other operator identifiers.
 */
describe("Issue #792 — registry owner permission guidance", () => {
  it("returns registered guidance for REGISTRY_OWNER_PERMISSION_DENIED", () => {
    const g = getPayrollFailureGuidance("REGISTRY_OWNER_PERMISSION_DENIED");
    expect(g).not.toBeNull();
    expect(g!.severity).toBe("error");
    expect(g!.affectedArea).toBe("execution");
    expect(g!.userFacingMessage.toLowerCase()).toContain("registered");
    expect(g!.remediation.length).toBeGreaterThanOrEqual(2);
  });

  it("does not expose owner wallet addresses or role names in copy", () => {
    const g = PAYROLL_FAILURE_REGISTRY.REGISTRY_OWNER_PERMISSION_DENIED;
    const allText = [g.summary, g.userFacingMessage, ...g.remediation].join("\n");
    // Guidance must never embed raw wallet hex, PII, or the canonical role
    // strings used in the internal ACL. Tests hardcoded a few representative
    // patterns a leak would most likely surface.
    expect(allText).not.toMatch(/0x[a-fA-F0-9]{6,}/);
    expect(allText).not.toMatch(/\bemp[-_]/i);
    expect(allText).not.toMatch(/\bowner_wallet\b/i);
  });

  it("returns null for an unrelated code (rejection boundary)", () => {
    expect(getPayrollFailureGuidance("REGISTRY_OWNER_SOMETHING_ELSE")).toBeNull();
    expect(getPayrollFailureGuidance("")).toBeNull();
  });
});
