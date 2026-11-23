import { describe, expect, it, beforeEach } from "vitest";
import {
  createReinstatementReview,
  submitReviewStep,
  approveReinstatementReview,
  rejectReinstatementReview,
  evaluateReinstatementReview,
  validateBatchReinstatementReviews,
  maskAddress,
  type ReinstatementReviewRecord,
  type CreateReinstatementReviewInput,
  DEFAULT_REINSTATEMENT_POLICY,
} from "../src/payroll/employeeReinstatementPayrollReview";

const VALID_WALLET = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const NOW = 1776758400000;
const FUTURE_DATE = "2026-11-15T00:00:00Z";

describe("Dashboard Employee Reinstatement Payroll Review Workflow", () => {
  let sampleInput: CreateReinstatementReviewInput;

  beforeEach(() => {
    sampleInput = {
      id: "rev_reinstatement_01",
      employeeRef: "EMP_REINSTATE_001",
      employeeName: "Adanna Okon",
      previousStatus: "suspended",
      reinstatementEffectiveDate: FUTURE_DATE,
      walletAddress: VALID_WALLET,
      reinstatementReason: "Completed medical leave. Return to duties authorized.",
      now: NOW,
    };
  });

  it("completes full review lifecycle: creation -> verification steps -> approval", () => {
    let review = createReinstatementReview(sampleInput);
    expect(review.status).toBe("pending_review");
    expect(review.walletAddressMasked).toBe("GDQP2...G4W37");

    // Complete all required review gates
    review = submitReviewStep(review, "roster_eligibility_check", "admin_lead", NOW + 100);
    review = submitReviewStep(review, "onboarding_completion_verification", "admin_lead", NOW + 200);
    review = submitReviewStep(review, "payout_destination_confirmation", "admin_lead", NOW + 300);
    review = submitReviewStep(review, "compensation_policy_verification", "admin_lead", NOW + 400);

    expect(review.status).toBe("under_review");
    expect(review.completedSteps.length).toBe(4);

    const approved = approveReinstatementReview(
      review,
      "admin_lead",
      "admin",
      NOW + 500,
      "Ready for next payroll cycle inclusion",
    );

    expect(approved.status).toBe("approved");
    expect(approved.reviewerId).toBe("admin_lead");

    const evaluation = evaluateReinstatementReview(approved, DEFAULT_REINSTATEMENT_POLICY, NOW + 600);
    expect(evaluation.status).toBe("approved");
    expect(evaluation.canApprove).toBe(false);
    expect(evaluation.message).toContain("Reinstatement approved for Adanna Okon");
  });

  it("handles rejection path cleanly with audit reason", () => {
    const review = createReinstatementReview(sampleInput);
    const rejected = rejectReinstatementReview(
      review,
      "compliance_officer",
      "Failed background check re-verification.",
      "admin",
      NOW + 100,
    );

    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Failed background check re-verification.");

    const evaluation = evaluateReinstatementReview(rejected, DEFAULT_REINSTATEMENT_POLICY, NOW + 200);
    expect(evaluation.status).toBe("rejected");
    expect(evaluation.validationErrors[0]).toContain("Failed background check re-verification");
  });

  it("evaluates batch payroll readiness and catches unapproved reinstatements", () => {
    let review1 = createReinstatementReview({ ...sampleInput, id: "rev_01" });
    review1 = submitReviewStep(review1, "roster_eligibility_check", "admin", NOW);
    review1 = submitReviewStep(review1, "onboarding_completion_verification", "admin", NOW);
    review1 = submitReviewStep(review1, "payout_destination_confirmation", "admin", NOW);
    review1 = submitReviewStep(review1, "compensation_policy_verification", "admin", NOW);
    const approved1 = approveReinstatementReview(review1, "admin", "admin", NOW);

    const pendingReview = createReinstatementReview({
      ...sampleInput,
      id: "rev_02",
      employeeName: "David Chen",
      employeeRef: "EMP_002",
    });

    const batch = validateBatchReinstatementReviews([approved1, pendingReview], DEFAULT_REINSTATEMENT_POLICY, NOW);
    expect(batch.canProceedWithPayroll).toBe(false);
    expect(batch.approvedCount).toBe(1);
    expect(batch.pendingCount).toBe(1);
    expect(batch.blockerMessage).toContain("David Chen (Pending review)");
  });

  it("masks destination address protecting employee privacy", () => {
    expect(maskAddress(VALID_WALLET)).toBe("GDQP2...G4W37");
  });
});
