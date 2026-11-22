import { describe, expect, it } from "vitest";
import {
  evaluatePayoutBatchRetryGuidance,
  DEFAULT_PAYOUT_BATCH_MAX_RETRIES,
  RETRY_DECISION_OUTCOME_LABELS,
  type PayoutBatchRetryEvaluationInput,
} from "@/lib/payroll/payoutBatchRetryGuidance";

describe("evaluatePayoutBatchRetryGuidance", () => {
  describe("Success cases: retry permitted within policy", () => {
    it("permits initial retry within policy (attempt 1 of 3)", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_001",
        attempt: 1,
      });

      expect(guidance.outcome).toBe("allowed");
      expect(guidance.reason).toBe("RETRY_WITHIN_POLICY");
      expect(guidance.canRetry).toBe(true);
      expect(guidance.attempt).toBe(1);
      expect(guidance.maxAttempts).toBe(DEFAULT_PAYOUT_BATCH_MAX_RETRIES);
      expect(guidance.remainingAttempts).toBe(2);
      expect(guidance.title).toBe("Retry Permitted Within Policy");
      expect(guidance.guidance).toMatch(/2 attempt\(s\) remaining/i);
      expect(guidance.nextSteps.length).toBeGreaterThan(0);
      expect(guidance.nextSteps[0]).toMatch(/confirm batch parameters/i);
    });

    it("permits subsequent retry within policy (attempt 2 of 3)", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_002",
        attempt: 2,
      });

      expect(guidance.outcome).toBe("allowed");
      expect(guidance.reason).toBe("RETRY_WITHIN_POLICY");
      expect(guidance.remainingAttempts).toBe(1);
      expect(guidance.guidance).toMatch(/1 attempt\(s\) remaining/i);
    });

    it("permits retry on the final allowed attempt (attempt 3 of 3)", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_003",
        attempt: 3,
      });

      expect(guidance.outcome).toBe("allowed");
      expect(guidance.reason).toBe("RETRY_WITHIN_POLICY");
      expect(guidance.remainingAttempts).toBe(0);
      expect(guidance.canRetry).toBe(true);
    });

    it("permits retry with actionable guidance when reconciliation has discrepancies", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_reconcile_disc",
        attempt: 1,
        reconciliationStatus: "failed",
        discrepancies: ["Recipient commitment root hash mismatch"],
      });

      expect(guidance.outcome).toBe("allowed");
      expect(guidance.reason).toBe("DISCREPANCIES_FOUND");
      expect(guidance.canRetry).toBe(true);
      expect(guidance.title).toBe("Discrepancies Found During Reconciliation");
      expect(guidance.guidance).toMatch(/review reconciliation discrepancy details/i);
      expect(guidance.remediationHref).toBe("/payroll/reconciliation");
      expect(guidance.remediationLabel).toBe("Review Reconciliation Details");
    });

    it("permits retry with actionable guidance when reconciliation reported generic failure", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_reconcile_fail",
        attempt: 1,
        reconciliationStatus: "failed",
      });

      expect(guidance.outcome).toBe("allowed");
      expect(guidance.reason).toBe("RECONCILIATION_FAILED");
      expect(guidance.canRetry).toBe(true);
      expect(guidance.title).toBe("Reconciliation Reported Failure");
      expect(guidance.remediationHref).toBe("/payroll/reconciliation");
    });
  });

  describe("Blocking cases: safety and compliance constraints", () => {
    it("blocks retry when smart contracts are paused", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_paused",
        isMutationDisabled: true,
        pauseReason: "Emergency multi-sig validator upgrade in progress",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("CONTRACT_PAUSED");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.message).toMatch(/Emergency multi-sig validator upgrade in progress/);
      expect(guidance.guidance).toMatch(/Review pause status in Admin Settings/i);
      expect(guidance.remediationHref).toBe("/admin");
      expect(guidance.remediationLabel).toBe("Review Pause Status in Admin Settings");
      expect(guidance.nextSteps).toContain("Review contract pause status in Admin Settings");
    });

    it("blocks retry when payout batch is already settled (receiptId present)", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_settled_receipt",
        receiptId: "receipt_0x123abc",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("ALREADY_SETTLED");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.guidance).toMatch(/prevent duplicate disbursements/i);
      expect(guidance.remediationHref).toBe("/history");
      expect(guidance.remediationLabel).toBe("View Settlement History");
    });

    it("blocks retry while the payout token is paused with privacy-safe recovery steps", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_token_paused",
        isPayoutTokenPaused: true,
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("PAYOUT_TOKEN_PAUSED");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.guidance).toMatch(/Wait for the payout asset to be resumed/i);
      expect(guidance.nextSteps).toContain(
        "After resumption, confirm this batch has not settled and review reconciliation before retrying",
      );
      expect(guidance.remediationHref).toBe("/settings/assets");
      expect(guidance.guidance).not.toMatch(/\$\d+|\bemp_[a-zA-Z0-9_-]+\b|G[A-Z2-7]{55}/i);
    });

    it("prioritizes settlement safety over a paused-token retry condition", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_settled_token_paused",
        isPayoutTokenPaused: true,
        receiptId: "receipt_test",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("ALREADY_SETTLED");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.remediationHref).toBe("/history");
    });

    it("blocks retry when transaction hash or verified status is present", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_settled_tx",
        transactionHash: "0xdeadbeef12345678",
        status: "verified",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("ALREADY_SETTLED");
      expect(guidance.canRetry).toBe(false);
    });

    it("blocks retry when referenced company is inactive (#762)", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_inactive_comp",
        hasInactiveCompany: true,
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("COMPANY_INACTIVE");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.guidance).toMatch(/referenced company profile is reactivated/i);
      expect(guidance.remediationHref).toBe("/company/switch");
      expect(guidance.remediationLabel).toBe("Switch Company Context");
    });

    it("blocks retry when the payroll run was cancelled", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_cancelled",
        status: "cancelled",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("RUN_CANCELLED");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.guidance).toMatch(/Create a new draft batch/i);
      expect(guidance.remediationHref).toBe("/payroll/create");
    });

    it("blocks retry when treasury is underfunded", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_treasury",
        cancellationReason: "treasury_insufficient",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("TREASURY_INSUFFICIENT");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.remediationHref).toBe("/treasury");
      expect(guidance.remediationLabel).toBe("Fund Treasury");
    });

    it("blocks retry when approval was rejected", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_rejected",
        cancellationReason: "approval_rejected",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("APPROVAL_REJECTED");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.remediationHref).toBe("/payroll/approvals");
      expect(guidance.remediationLabel).toBe("Review Approval Queue");
    });

    it("blocks retry when compliance hold is active", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_compliance",
        cancellationReason: "compliance_hold",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("COMPLIANCE_HOLD");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.remediationHref).toBe("/compliance");
    });

    it("blocks retry when ZK proof expired", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_proof_expired",
        cancellationReason: "expired_proof",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("EXPIRED_PROOF");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.remediationHref).toBe("/payroll/execute");
    });

    it("blocks retry when duplicate batch is detected", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_duplicate",
        cancellationReason: "duplicate_batch",
      });

      expect(guidance.outcome).toBe("blocked");
      expect(guidance.reason).toBe("DUPLICATE_BATCH");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.remediationHref).toBe("/history");
    });
  });

  describe("Boundary cases: retry attempt thresholds", () => {
    it("defers retry when attempts exceed max attempts (attempt 4 with max 3)", () => {
      const guidance = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_exhausted",
        attempt: 4,
        maxAttempts: 3,
      });

      expect(guidance.outcome).toBe("deferred");
      expect(guidance.reason).toBe("MAX_ATTEMPTS_EXCEEDED");
      expect(guidance.canRetry).toBe(false);
      expect(guidance.remainingAttempts).toBe(0);
      expect(guidance.title).toBe("Maximum Retry Limit Reached");
      expect(guidance.guidance).toMatch(/Retry attempts exhausted/i);
      expect(guidance.nextSteps).toContain("Contact an approver to request a new batch");
      expect(guidance.remediationHref).toBe("/payroll/reconciliation");
    });

    it("safely handles custom max attempts (e.g. 5 attempts)", () => {
      const guidance4 = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_custom_max",
        attempt: 4,
        maxAttempts: 5,
      });
      expect(guidance4.outcome).toBe("allowed");
      expect(guidance4.remainingAttempts).toBe(1);

      const guidance6 = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_custom_max",
        attempt: 6,
        maxAttempts: 5,
      });
      expect(guidance6.outcome).toBe("deferred");
      expect(guidance6.remainingAttempts).toBe(0);
    });

    it("normalizes invalid or negative attempts safely to attempt 1", () => {
      const guidanceNeg = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_norm",
        attempt: -5,
      });
      expect(guidanceNeg.attempt).toBe(1);
      expect(guidanceNeg.outcome).toBe("allowed");

      const guidanceNaN = evaluatePayoutBatchRetryGuidance({
        payrollId: "run_batch_norm",
        attempt: Number.NaN,
      });
      expect(guidanceNaN.attempt).toBe(1);
    });

    it("handles missing inputs gracefully without throwing", () => {
      const guidanceEmpty = evaluatePayoutBatchRetryGuidance({
        payrollId: "",
      });
      expect(guidanceEmpty.payrollId).toBe("unknown-payroll");
      expect(guidanceEmpty.outcome).toBe("allowed");
      expect(guidanceEmpty.canRetry).toBe(true);
    });
  });

  describe("Privacy preservation: zero data leaks", () => {
    it("never exposes employee identities, salaries, or wallet addresses in guidance output", () => {
      const testCases: PayoutBatchRetryEvaluationInput[] = [
        { payrollId: "run_001", attempt: 1 },
        { payrollId: "run_002", attempt: 4 },
        { payrollId: "run_003", isMutationDisabled: true, pauseReason: "Emergency maintenance" },
        { payrollId: "run_004", receiptId: "receipt_001", status: "verified" },
        { payrollId: "run_005", hasInactiveCompany: true },
        { payrollId: "run_006", cancellationReason: "treasury_insufficient" },
        { payrollId: "run_007", cancellationReason: "expired_proof" },
        { payrollId: "run_008", reconciliationStatus: "failed", discrepancies: ["Hash drift"] },
      ];

      const forbiddenPatterns = [
        /\$\d+/i,
        /salary/i,
        /compensation/i,
        /wallet_0x/i,
        /G[A-Z0-9]{55}/,
        /secret/i,
        /private_key/i,
        /ssn/i,
      ];

      for (const testCase of testCases) {
        const result = evaluatePayoutBatchRetryGuidance(testCase);
        const serialized = JSON.stringify(result);

        for (const pattern of forbiddenPatterns) {
          expect(serialized).not.toMatch(pattern);
        }
      }
    });

    it("RETRY_DECISION_OUTCOME_LABELS maps all outcomes cleanly", () => {
      expect(RETRY_DECISION_OUTCOME_LABELS.allowed).toBe("Retry permitted");
      expect(RETRY_DECISION_OUTCOME_LABELS.blocked).toBe("Retry blocked");
      expect(RETRY_DECISION_OUTCOME_LABELS.deferred).toBe("Retry deferred");
    });
  });
});
