import { describe, it, expect } from "vitest";
import {
  selectAndValidateFailoverSource,
  validateSingleFailoverCandidate,
  assertFundingFailoverValid,
  FundingSourceFailoverValidationError,
  type FundingSource,
  type FailoverPolicy,
  type FailoverEvaluationContext,
} from "@/src/payroll/fundingSourceFailoverValidation";

describe("fundingSourceFailoverValidation", () => {
  const NOW = 1_700_000_000_000;

  const POLICY: FailoverPolicy = {
    bufferPercentage: 0.1, // 10%
    maxAutomaticFailoverLimit: 10_000,
    cooldownPeriodSeconds: 3600,
    requireOperatorConfirmationAboveLimit: true,
  };

  const CONTEXT: FailoverEvaluationContext = {
    payrollRunId: "run-99",
    requiredAmount: 5_000,
    requiredAssetCode: "USDC",
    primarySourceId: "treasury-primary",
    now: NOW,
  };

  const SOURCE_TIER_1: FundingSource = {
    id: "backup-safe",
    label: "Treasury Safe Backup",
    sourceType: "multisig_vault",
    assetCode: "USDC",
    availableBalance: 8_000,
    status: "active",
    priorityTier: 1,
  };

  const SOURCE_TIER_2: FundingSource = {
    id: "hot-reserve",
    label: "Hot Wallet Reserve",
    sourceType: "hot_wallet",
    assetCode: "USDC",
    availableBalance: 20_000,
    status: "active",
    priorityTier: 2,
  };

  describe("validateSingleFailoverCandidate", () => {
    it("qualifies an active candidate with sufficient balance", () => {
      const res = validateSingleFailoverCandidate(SOURCE_TIER_1, CONTEXT, POLICY);
      expect(res.eligible).toBe(true);
    });

    it("rejects primary source candidate", () => {
      const res = validateSingleFailoverCandidate(
        { ...SOURCE_TIER_1, id: "treasury-primary" },
        CONTEXT,
        POLICY,
      );
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe("ineligible_source");
    });

    it("rejects non-active candidates", () => {
      const res = validateSingleFailoverCandidate(
        { ...SOURCE_TIER_1, status: "suspended" },
        CONTEXT,
        POLICY,
      );
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe("ineligible_source");
    });

    it("rejects asset code mismatch", () => {
      const res = validateSingleFailoverCandidate(
        { ...SOURCE_TIER_1, assetCode: "XLM" },
        CONTEXT,
        POLICY,
      );
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe("asset_mismatch");
    });

    it("rejects insufficient funds including buffer", () => {
      // 5000 required + 10% buffer = 5500. Balance of 5200 is insufficient!
      const res = validateSingleFailoverCandidate(
        { ...SOURCE_TIER_1, availableBalance: 5200 },
        CONTEXT,
        POLICY,
      );
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe("insufficient_funds");
    });

    it("rejects candidate in cooldown period", () => {
      const res = validateSingleFailoverCandidate(
        { ...SOURCE_TIER_1, lastFailoverTimestamp: NOW - 600 * 1000 }, // 10 mins ago (< 1h cooldown)
        CONTEXT,
        POLICY,
      );
      expect(res.eligible).toBe(false);
      expect(res.reason).toBe("cooldown_active");
    });
  });

  describe("selectAndValidateFailoverSource", () => {
    it("selects highest priority tier candidate", () => {
      const result = selectAndValidateFailoverSource(
        [SOURCE_TIER_2, SOURCE_TIER_1],
        CONTEXT,
        POLICY,
      );

      expect(result.isValid).toBe(true);
      expect(result.selectedSource?.id).toBe("backup-safe"); // Priority tier 1 wins over tier 2 despite smaller balance
      expect(result.requiredTotalWithBuffer).toBe(5500);
    });

    it("requires operator confirmation above automatic threshold", () => {
      const largeContext: FailoverEvaluationContext = {
        ...CONTEXT,
        requiredAmount: 15_000, // exceeds 10,000 limit
      };

      const result = selectAndValidateFailoverSource(
        [SOURCE_TIER_2],
        largeContext,
        POLICY,
      );

      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe("authorization_required");
      expect(result.message).toContain("Explicit operator confirmation is required");
    });

    it("proceeds above limit when operator has confirmed", () => {
      const largeConfirmedContext: FailoverEvaluationContext = {
        ...CONTEXT,
        requiredAmount: 15_000,
        operatorConfirmed: true,
      };

      const result = selectAndValidateFailoverSource(
        [SOURCE_TIER_2],
        largeConfirmedContext,
        POLICY,
      );

      expect(result.isValid).toBe(true);
      expect(result.selectedSource?.id).toBe("hot-reserve");
    });

    it("returns no_candidates when all sources fail validation", () => {
      const result = selectAndValidateFailoverSource(
        [{ ...SOURCE_TIER_1, status: "depleted" }],
        CONTEXT,
        POLICY,
      );

      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe("no_candidates");
    });
  });

  describe("assertFundingFailoverValid", () => {
    it("returns selected source when valid", () => {
      const source = assertFundingFailoverValid(
        [SOURCE_TIER_1],
        CONTEXT,
        POLICY,
      );
      expect(source.id).toBe("backup-safe");
    });

    it("throws FundingSourceFailoverValidationError when invalid", () => {
      expect(() =>
        assertFundingFailoverValid([], CONTEXT, POLICY),
      ).toThrowError(FundingSourceFailoverValidationError);
    });
  });
});
