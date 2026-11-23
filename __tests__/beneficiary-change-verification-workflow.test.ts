import { describe, it, expect } from "vitest";
import {
  createBeneficiaryChangeRequest,
  submitVerificationStep,
  evaluateBeneficiaryChangeReadiness,
  assertBeneficiaryChangeExecutable,
  BeneficiaryChangeWorkflowError,
  maskAddress,
  type BeneficiaryChangeWorkflowPolicy,
} from "@/src/payroll/beneficiaryChangeVerificationWorkflow";

describe("beneficiaryChangeVerificationWorkflow", () => {
  const NOW = 1_700_000_000_000;
  const POLICY: BeneficiaryChangeWorkflowPolicy = {
    coolingOffDurationSeconds: 3600, // 1 hour for test
    requireTwoFactor: true,
    requireDualApproval: true,
    requestTtlSeconds: 86400, // 24 hours
  };

  describe("maskAddress", () => {
    it("masks a long Stellar address properly", () => {
      expect(maskAddress("GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ")).toBe("GA7Q...VSGZ");
    });

    it("masks short or invalid addresses safely", () => {
      expect(maskAddress("GABC")).toBe("********");
    });
  });

  describe("createBeneficiaryChangeRequest", () => {
    it("creates request in pending_verification status", () => {
      const req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: POLICY,
      });

      expect(req.id).toBe("bcr-1");
      expect(req.status).toBe("pending_verification");
      expect(req.completedSteps).toHaveLength(0);
      expect(req.coolingOffDurationSeconds).toBe(3600);
    });

    it("throws when required fields are missing", () => {
      expect(() =>
        createBeneficiaryChangeRequest({
          id: "",
          employeeRef: "emp-99",
          currentAddressMasked: "GAAA...1111",
          proposedAddressMasked: "GBBB...2222",
          requestedBy: "op-alice",
        }),
      ).toThrowError("Beneficiary change request id must be provided");
    });
  });

  describe("submitVerificationStep", () => {
    it("prevents self-approval for dual operator sign-off", () => {
      const req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: POLICY,
      });

      expect(() =>
        submitVerificationStep(req, "dual_operator_signoff", "op-alice", NOW, POLICY),
      ).toThrowError("Dual operator sign-off must be performed by a different operator");
    });

    it("transitions to cooling_off once all steps are satisfied", () => {
      let req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: POLICY,
      });

      req = submitVerificationStep(req, "contributor_confirmation", "contributor", NOW, POLICY);
      expect(req.status).toBe("pending_verification");

      req = submitVerificationStep(req, "two_factor_auth", "contributor", NOW, POLICY);
      expect(req.status).toBe("pending_verification");

      req = submitVerificationStep(req, "dual_operator_signoff", "op-bob", NOW, POLICY);
      expect(req.status).toBe("cooling_off");
      expect(req.coolingOffStartedAt).toBe(NOW);
    });
  });

  describe("evaluateBeneficiaryChangeReadiness", () => {
    it("blocks execution if steps are missing", () => {
      const req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: POLICY,
      });

      const decision = evaluateBeneficiaryChangeReadiness(
        req,
        { now: NOW, isPayrollInProgress: false },
        POLICY,
      );

      expect(decision.canExecute).toBe(false);
      expect(decision.rejectionReason).toBe("verification_incomplete");
      expect(decision.missingSteps).toContain("two_factor_auth");
    });

    it("blocks execution during active payroll run", () => {
      let req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: POLICY,
      });

      req = submitVerificationStep(req, "contributor_confirmation", "contributor", NOW, POLICY);
      req = submitVerificationStep(req, "two_factor_auth", "contributor", NOW, POLICY);
      req = submitVerificationStep(req, "dual_operator_signoff", "op-bob", NOW, POLICY);

      // Now beyond cooling off
      const decision = evaluateBeneficiaryChangeReadiness(
        req,
        { now: NOW + 4000 * 1000, isPayrollInProgress: true },
        POLICY,
      );

      expect(decision.canExecute).toBe(false);
      expect(decision.rejectionReason).toBe("payroll_in_progress");
    });

    it("blocks execution while cooling off is active", () => {
      let req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: POLICY,
      });

      req = submitVerificationStep(req, "contributor_confirmation", "contributor", NOW, POLICY);
      req = submitVerificationStep(req, "two_factor_auth", "contributor", NOW, POLICY);
      req = submitVerificationStep(req, "dual_operator_signoff", "op-bob", NOW, POLICY);

      // 1800 seconds into 3600s cooling off
      const decision = evaluateBeneficiaryChangeReadiness(
        req,
        { now: NOW + 1800 * 1000, isPayrollInProgress: false },
        POLICY,
      );

      expect(decision.canExecute).toBe(false);
      expect(decision.rejectionReason).toBe("cooling_off_active");
      expect(decision.remainingCoolingOffSeconds).toBe(1800);
    });

    it("allows execution when cooling off has elapsed", () => {
      let req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: POLICY,
      });

      req = submitVerificationStep(req, "contributor_confirmation", "contributor", NOW, POLICY);
      req = submitVerificationStep(req, "two_factor_auth", "contributor", NOW, POLICY);
      req = submitVerificationStep(req, "dual_operator_signoff", "op-bob", NOW, POLICY);

      // 3601 seconds later
      const decision = evaluateBeneficiaryChangeReadiness(
        req,
        { now: NOW + 3601 * 1000, isPayrollInProgress: false },
        POLICY,
      );

      expect(decision.canExecute).toBe(true);
      expect(decision.status).toBe("verified_active");
    });

    it("flags expired requests", () => {
      const req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: POLICY,
      });

      // 10 days later (> 7 day TTL)
      const decision = evaluateBeneficiaryChangeReadiness(
        req,
        { now: NOW + 10 * 86400 * 1000, isPayrollInProgress: false },
        POLICY,
      );

      expect(decision.canExecute).toBe(false);
      expect(decision.status).toBe("expired");
      expect(decision.rejectionReason).toBe("request_expired");
    });
  });

  describe("assertBeneficiaryChangeExecutable", () => {
    it("throws BeneficiaryChangeWorkflowError when execution is blocked", () => {
      const req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: POLICY,
      });

      expect(() =>
        assertBeneficiaryChangeExecutable(
          req,
          { now: NOW, isPayrollInProgress: false },
          POLICY,
        ),
      ).toThrowError(BeneficiaryChangeWorkflowError);
    });

    it("does not throw when ready", () => {
      let req = createBeneficiaryChangeRequest({
        id: "bcr-1",
        employeeRef: "emp-99",
        currentAddressMasked: "GAAA...1111",
        proposedAddressMasked: "GBBB...2222",
        requestedBy: "op-alice",
        now: NOW,
        policy: { ...POLICY, coolingOffDurationSeconds: 0 },
      });

      req = submitVerificationStep(req, "contributor_confirmation", "contributor", NOW, {
        ...POLICY,
        coolingOffDurationSeconds: 0,
      });
      req = submitVerificationStep(req, "two_factor_auth", "contributor", NOW, {
        ...POLICY,
        coolingOffDurationSeconds: 0,
      });
      req = submitVerificationStep(req, "dual_operator_signoff", "op-bob", NOW, {
        ...POLICY,
        coolingOffDurationSeconds: 0,
      });

      expect(() =>
        assertBeneficiaryChangeExecutable(
          req,
          { now: NOW, isPayrollInProgress: false },
          { ...POLICY, coolingOffDurationSeconds: 0 },
        ),
      ).not.toThrow();
    });
  });
});
