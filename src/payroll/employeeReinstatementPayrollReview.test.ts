import { describe, it, expect, beforeEach } from "vitest";
import {
  createReinstatementReview,
  submitReviewStep,
  approveReinstatementReview,
  rejectReinstatementReview,
  evaluateReinstatementReview,
  validateBatchReinstatementReviews,
  maskAddress,
  getRequiredReviewSteps,
  type ReinstatementReviewRecord,
  type CreateReinstatementReviewInput,
  DEFAULT_REINSTATEMENT_POLICY,
} from "./employeeReinstatementPayrollReview";

const VALID_STELLAR_ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const NOW = 1776758400000; // Fixed timestamp for deterministic testing
const FUTURE_DATE = "2026-11-01T00:00:00Z";
const PAST_DATE = "2026-01-01T00:00:00Z";

describe("Employee Reinstatement Payroll Review", () => {
  let sampleInput: CreateReinstatementReviewInput;

  beforeEach(() => {
    sampleInput = {
      id: "rev_001",
      employeeRef: "emp_123",
      employeeName: "Elena Rostova",
      previousStatus: "suspended",
      reinstatementEffectiveDate: FUTURE_DATE,
      walletAddress: VALID_STELLAR_ADDRESS,
      reinstatementReason: "Completed sabbatical leave, returning to active payroll.",
      now: NOW,
    };
  });

  describe("maskAddress", () => {
    it("correctly masks a full Stellar address", () => {
      const masked = maskAddress(VALID_STELLAR_ADDRESS);
      expect(masked).toBe("GBBD4...LFLA5");
      expect(masked).not.toBe(VALID_STELLAR_ADDRESS);
    });

    it("handles short or empty address gracefully", () => {
      expect(maskAddress("")).toBe("G*****");
      expect(maskAddress("G123")).toBe("G1...");
    });
  });

  describe("createReinstatementReview", () => {
    it("creates a new reinstatement review in pending_review status", () => {
      const record = createReinstatementReview(sampleInput);

      expect(record.id).toBe("rev_001");
      expect(record.employeeRef).toBe("emp_123");
      expect(record.employeeName).toBe("Elena Rostova");
      expect(record.previousStatus).toBe("suspended");
      expect(record.status).toBe("pending_review");
      expect(record.walletAddressMasked).toBe("GBBD4...LFLA5");
      expect(record.completedSteps).toEqual([]);
      expect(record.createdAt).toBe(NOW);
      expect(record.reinstatementReason).toContain("sabbatical");
    });

    it("throws error when review ID is missing", () => {
      expect(() =>
        createReinstatementReview({ ...sampleInput, id: "" }),
      ).toThrow("Review ID must be provided.");
    });

    it("throws error when employee reference is missing", () => {
      expect(() =>
        createReinstatementReview({ ...sampleInput, employeeRef: "   " }),
      ).toThrow("Employee reference must be provided.");
    });

    it("throws error when employee name is missing", () => {
      expect(() =>
        createReinstatementReview({ ...sampleInput, employeeName: "" }),
      ).toThrow("Employee name must be provided.");
    });

    it("throws error when reinstatement reason is missing", () => {
      expect(() =>
        createReinstatementReview({ ...sampleInput, reinstatementReason: "" }),
      ).toThrow("Reinstatement reason must be provided.");
    });

    it("throws error when date format is invalid", () => {
      expect(() =>
        createReinstatementReview({
          ...sampleInput,
          reinstatementEffectiveDate: "invalid-date",
        }),
      ).toThrow("Invalid reinstatement effective date format.");
    });

    it("throws error when Stellar wallet address is invalid", () => {
      expect(() =>
        createReinstatementReview({
          ...sampleInput,
          walletAddress: "not-a-stellar-key",
        }),
      ).toThrow("A valid Stellar destination address is required");
    });

    it("rejects retroactive effective dates under default policy", () => {
      expect(() =>
        createReinstatementReview({
          ...sampleInput,
          reinstatementEffectiveDate: PAST_DATE,
        }),
      ).toThrow("Retroactive reinstatement date is not permitted");
    });

    it("permits retroactive effective date when policy explicitly allows it", () => {
      const record = createReinstatementReview({
        ...sampleInput,
        reinstatementEffectiveDate: PAST_DATE,
        policy: { allowRetroactiveEffectiveDate: true },
      });
      expect(record.id).toBe("rev_001");
      expect(record.reinstatementEffectiveDate).toBe(PAST_DATE);
    });
  });

  describe("submitReviewStep", () => {
    it("adds steps to completedSteps and transitions to under_review", () => {
      let record = createReinstatementReview(sampleInput);

      record = submitReviewStep(record, "roster_eligibility_check", "admin_01", NOW + 1000);
      expect(record.status).toBe("under_review");
      expect(record.completedSteps).toContain("roster_eligibility_check");
      expect(record.reviewerId).toBe("admin_01");

      record = submitReviewStep(record, "onboarding_completion_verification", "admin_01", NOW + 2000);
      expect(record.completedSteps).toHaveLength(2);
    });

    it("deduplicates identical steps", () => {
      let record = createReinstatementReview(sampleInput);
      record = submitReviewStep(record, "roster_eligibility_check", "admin_01", NOW + 1000);
      record = submitReviewStep(record, "roster_eligibility_check", "admin_01", NOW + 2000);
      expect(record.completedSteps).toEqual(["roster_eligibility_check"]);
    });

    it("throws if operatorId is not provided", () => {
      const record = createReinstatementReview(sampleInput);
      expect(() =>
        submitReviewStep(record, "roster_eligibility_check", ""),
      ).toThrow("Operator ID must be provided");
    });

    it("expires review if TTL has elapsed", () => {
      const record = createReinstatementReview(sampleInput);
      const afterTtl = NOW + DEFAULT_REINSTATEMENT_POLICY.reviewTtlSeconds * 1000 + 1000;
      const updated = submitReviewStep(record, "roster_eligibility_check", "admin_01", afterTtl);
      expect(updated.status).toBe("expired");
    });
  });

  describe("approveReinstatementReview", () => {
    let verifiedRecord: ReinstatementReviewRecord;

    beforeEach(() => {
      let record = createReinstatementReview(sampleInput);
      record = submitReviewStep(record, "roster_eligibility_check", "admin_01", NOW + 100);
      record = submitReviewStep(record, "onboarding_completion_verification", "admin_01", NOW + 200);
      record = submitReviewStep(record, "payout_destination_confirmation", "admin_01", NOW + 300);
      record = submitReviewStep(record, "compensation_policy_verification", "admin_01", NOW + 400);
      verifiedRecord = record;
    });

    it("approves the review when all prerequisites are fulfilled by an admin", () => {
      const approved = approveReinstatementReview(
        verifiedRecord,
        "admin_01",
        "admin",
        NOW + 500,
        "All compliance checks verified. Sabbatical concluded.",
      );

      expect(approved.status).toBe("approved");
      expect(approved.reviewerId).toBe("admin_01");
      expect(approved.reviewedAt).toBe(NOW + 500);
      expect(approved.completedSteps).toContain("operator_reinstatement_approval");
      expect(approved.notes).toContain("All compliance checks verified");
    });

    it("rejects non-admin role with an authorization error", () => {
      expect(() =>
        approveReinstatementReview(verifiedRecord, "op_01", "operator", NOW + 500),
      ).toThrow("Only administrators are authorized to approve");
    });

    it("throws error if prerequisite verification steps are missing", () => {
      const incompleteRecord = createReinstatementReview(sampleInput);
      expect(() =>
        approveReinstatementReview(incompleteRecord, "admin_01", "admin", NOW + 500),
      ).toThrow("prerequisite verification step(s) remaining");
    });

    it("throws if already approved", () => {
      const approved = approveReinstatementReview(verifiedRecord, "admin_01", "admin", NOW + 500);
      expect(() =>
        approveReinstatementReview(approved, "admin_01", "admin", NOW + 600),
      ).toThrow("Reinstatement review is already approved");
    });
  });

  describe("rejectReinstatementReview", () => {
    it("marks review as rejected with reason", () => {
      const record = createReinstatementReview(sampleInput);
      const rejected = rejectReinstatementReview(
        record,
        "admin_01",
        "Employee has unresolved disciplinary hold.",
        "admin",
        NOW + 1000,
      );

      expect(rejected.status).toBe("rejected");
      expect(rejected.rejectionReason).toBe("Employee has unresolved disciplinary hold.");
      expect(rejected.reviewerId).toBe("admin_01");
    });

    it("requires admin role to reject", () => {
      const record = createReinstatementReview(sampleInput);
      expect(() =>
        rejectReinstatementReview(record, "op_01", "reason", "operator", NOW + 1000),
      ).toThrow("Only administrators are authorized to reject");
    });

    it("throws if rejection reason is missing", () => {
      const record = createReinstatementReview(sampleInput);
      expect(() =>
        rejectReinstatementReview(record, "admin_01", "   ", "admin", NOW + 1000),
      ).toThrow("A clear rejection reason must be provided");
    });

    it("cannot modify review with terminal status", () => {
      const record = createReinstatementReview(sampleInput);
      const rejected = rejectReinstatementReview(record, "admin_01", "hold", "admin", NOW + 1000);
      expect(() =>
        rejectReinstatementReview(rejected, "admin_01", "hold2", "admin", NOW + 2000),
      ).toThrow("Cannot reject reinstatement review with status 'rejected'");
    });
  });

  describe("evaluateReinstatementReview", () => {
    it("evaluates a pending review correctly", () => {
      const record = createReinstatementReview(sampleInput);
      const evalResult = evaluateReinstatementReview(record, DEFAULT_REINSTATEMENT_POLICY, NOW + 100);

      expect(evalResult.status).toBe("pending_review");
      expect(evalResult.canApprove).toBe(true);
      expect(evalResult.canReject).toBe(true);
      expect(evalResult.isExpired).toBe(false);
      expect(evalResult.missingSteps.length).toBeGreaterThan(0);
      expect(evalResult.message).toContain("pending verification");
    });

    it("evaluates an approved review correctly", () => {
      let record = createReinstatementReview(sampleInput);
      record = submitReviewStep(record, "roster_eligibility_check", "admin_01", NOW + 100);
      record = submitReviewStep(record, "onboarding_completion_verification", "admin_01", NOW + 200);
      record = submitReviewStep(record, "payout_destination_confirmation", "admin_01", NOW + 300);
      record = submitReviewStep(record, "compensation_policy_verification", "admin_01", NOW + 400);
      const approved = approveReinstatementReview(record, "admin_01", "admin", NOW + 500);

      const evalResult = evaluateReinstatementReview(approved, DEFAULT_REINSTATEMENT_POLICY, NOW + 600);
      expect(evalResult.status).toBe("approved");
      expect(evalResult.canApprove).toBe(false);
      expect(evalResult.canReject).toBe(false);
      expect(evalResult.message).toContain("Reinstatement approved for Elena Rostova");
      expect(evalResult.validationErrors).toEqual([]);
    });

    it("detects expired status when timestamp exceeds TTL", () => {
      const record = createReinstatementReview(sampleInput);
      const futureTime = NOW + DEFAULT_REINSTATEMENT_POLICY.reviewTtlSeconds * 1000 + 5000;
      const evalResult = evaluateReinstatementReview(record, DEFAULT_REINSTATEMENT_POLICY, futureTime);

      expect(evalResult.isExpired).toBe(true);
      expect(evalResult.status).toBe("expired");
      expect(evalResult.canApprove).toBe(false);
      expect(evalResult.validationErrors[0]).toContain("Review period has expired");
    });
  });

  describe("validateBatchReinstatementReviews", () => {
    it("returns canProceedWithPayroll: true when all reviews are approved", () => {
      let record1 = createReinstatementReview({ ...sampleInput, id: "rev_01" });
      record1 = submitReviewStep(record1, "roster_eligibility_check", "admin_01", NOW);
      record1 = submitReviewStep(record1, "onboarding_completion_verification", "admin_01", NOW);
      record1 = submitReviewStep(record1, "payout_destination_confirmation", "admin_01", NOW);
      record1 = submitReviewStep(record1, "compensation_policy_verification", "admin_01", NOW);
      const approved1 = approveReinstatementReview(record1, "admin_01", "admin", NOW);

      let record2 = createReinstatementReview({
        ...sampleInput,
        id: "rev_02",
        employeeRef: "emp_456",
        employeeName: "Marcus Vance",
      });
      record2 = submitReviewStep(record2, "roster_eligibility_check", "admin_01", NOW);
      record2 = submitReviewStep(record2, "onboarding_completion_verification", "admin_01", NOW);
      record2 = submitReviewStep(record2, "payout_destination_confirmation", "admin_01", NOW);
      record2 = submitReviewStep(record2, "compensation_policy_verification", "admin_01", NOW);
      const approved2 = approveReinstatementReview(record2, "admin_01", "admin", NOW);

      const batch = validateBatchReinstatementReviews([approved1, approved2], DEFAULT_REINSTATEMENT_POLICY, NOW);

      expect(batch.totalReviews).toBe(2);
      expect(batch.approvedCount).toBe(2);
      expect(batch.canProceedWithPayroll).toBe(true);
      expect(batch.blockerMessage).toBeNull();
    });

    it("blocks and generates actionable blocker message when any review is not approved", () => {
      const pendingRecord = createReinstatementReview(sampleInput);
      const batch = validateBatchReinstatementReviews([pendingRecord], DEFAULT_REINSTATEMENT_POLICY, NOW);

      expect(batch.canProceedWithPayroll).toBe(false);
      expect(batch.pendingCount).toBe(1);
      expect(batch.blockerMessage).toContain("1 employee reinstatement(s) have unapproved payroll reviews");
      expect(batch.blockerMessage).toContain("Elena Rostova (Pending review)");
    });

    it("handles empty review list gracefully", () => {
      const batch = validateBatchReinstatementReviews([], DEFAULT_REINSTATEMENT_POLICY, NOW);
      expect(batch.totalReviews).toBe(0);
      expect(batch.canProceedWithPayroll).toBe(true);
      expect(batch.blockerMessage).toBeNull();
    });
  });

  describe("Privacy & Data Safety", () => {
    it("never exposes unmasked wallet addresses or financial secrets in records or evaluations", () => {
      const record = createReinstatementReview(sampleInput);
      const json = JSON.stringify(record);

      expect(json).not.toContain(VALID_STELLAR_ADDRESS);
      expect(json).toContain("GBBD4...LFLA5");

      const evalResult = evaluateReinstatementReview(record, DEFAULT_REINSTATEMENT_POLICY, NOW);
      const evalJson = JSON.stringify(evalResult);
      expect(evalJson).not.toContain(VALID_STELLAR_ADDRESS);
    });
  });
});
