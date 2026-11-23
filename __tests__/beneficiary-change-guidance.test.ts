import { describe, it, expect } from "vitest";
import { describeBeneficiaryChangeGuidance, formatCoolingOff } from "@/lib/employees/beneficiaryChangeGuidance";
import type { BeneficiaryChangeDecision } from "@/src/payroll/beneficiaryChangeVerificationWorkflow";

function decision(overrides: Partial<BeneficiaryChangeDecision>): BeneficiaryChangeDecision {
  return {
    canExecute: false,
    status: "pending_verification",
    message: "",
    missingSteps: [],
    remainingCoolingOffSeconds: 0,
    ...overrides,
  };
}

describe("describeBeneficiaryChangeGuidance (#902)", () => {
  it("lists the outstanding verification steps in plain language (success path)", () => {
    const g = describeBeneficiaryChangeGuidance(
      decision({ missingSteps: ["two_factor_auth", "dual_operator_signoff"] }),
    );
    expect(g.tone).toBe("info");
    expect(g.nextSteps).toEqual([
      "Complete two-factor verification",
      "Get sign-off from a second operator",
    ]);
  });

  it("tells the operator to wait during cooling-off, with the remaining time (boundary path)", () => {
    const g = describeBeneficiaryChangeGuidance(
      decision({ status: "cooling_off", remainingCoolingOffSeconds: 3 * 86400 }),
    );
    expect(g.tone).toBe("warning");
    expect(g.body).toContain("3 days");
  });

  it("explains a rejection and says what to do next (failure path)", () => {
    const g = describeBeneficiaryChangeGuidance(
      decision({ status: "rejected", rejectionReason: "Employee did not confirm" }),
    );
    expect(g.tone).toBe("blocked");
    expect(g.body).toContain("Employee did not confirm");
    expect(g.nextSteps).toEqual(["Submit a new request if the change is still needed"]);
  });

  it("never exposes an address or employee name in its output", () => {
    const g = describeBeneficiaryChangeGuidance(
      decision({ status: "rejected", rejectionReason: "Mismatch" }),
    );
    expect(JSON.stringify(g)).not.toMatch(/G[A-Z2-7]{20,}/);
  });
});

describe("formatCoolingOff", () => {
  it("uses hours below 48 hours and days beyond (boundary)", () => {
    expect(formatCoolingOff(0)).toBe("0 minutes");
    expect(formatCoolingOff(3600)).toBe("1 hour");
    expect(formatCoolingOff(47 * 3600)).toBe("47 hours");
    expect(formatCoolingOff(48 * 3600)).toBe("2 days");
  });
});
