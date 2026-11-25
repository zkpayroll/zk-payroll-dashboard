import { describe, it, expect } from "vitest";
import {
  getPayrollFailureGuidance,
  PAYROLL_FAILURE_REGISTRY,
} from "@/lib/payroll/failureCodeGuidance";

/**
 * #797 — Stale proof key failures must explain what to do (regenerate against
 * the current key) without exposing the ZK circuit inputs, witness values,
 * or the stored verification-key blob itself.
 */
describe("Issue #797 — stale proof key guidance", () => {
  it("returns registered guidance for STALE_PROOF_KEY (success)", () => {
    const g = getPayrollFailureGuidance("STALE_PROOF_KEY");
    expect(g).not.toBeNull();
    expect(g!.severity).toBe("error");
    expect(g!.affectedArea).toBe("execution");
    // Guidance points to the Execute wizard so the operator has a concrete
    // next step rather than just the code.
    expect(g!.remediation.join(" ").toLowerCase()).toContain("execute");
  });

  it("never quotes circuit inputs, witnesses, or the key blob", () => {
    const g = PAYROLL_FAILURE_REGISTRY.STALE_PROOF_KEY;
    const text = [g.summary, g.userFacingMessage, ...g.remediation].join("\n").toLowerCase();
    // These are the field names the backend uses for the sensitive bits of a
    // proof payload. Any of them appearing in operator-facing text would be
    // a privacy regression, so we spell them out here.
    for (const forbidden of ["public_inputs", "publicinputs", "witness", "proof_bytes", "vk_blob", "vk_hash", "nullifier"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("returns null for near-miss codes (rejection boundary)", () => {
    expect(getPayrollFailureGuidance("STALE_PROOF")).toBeNull();
    expect(getPayrollFailureGuidance("stale_proof_key")).toBeNull();
    expect(getPayrollFailureGuidance("")).toBeNull();
  });
});
