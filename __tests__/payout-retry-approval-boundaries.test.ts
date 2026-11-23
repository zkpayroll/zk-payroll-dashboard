import { describe, it, expect } from "vitest";
import {
  evaluateRetryApprovalBoundaries,
  assertRetryApproved,
  RetryApprovalBoundaryError,
  DEFAULT_RETRY_APPROVAL_POLICY,
  type RetryApprovalPolicy,
  type RetryApprovalContext,
} from "@/src/payroll/payoutRetryApprovalBoundaries";

const BASE_POLICY: RetryApprovalPolicy = DEFAULT_RETRY_APPROVAL_POLICY;
const NOW = 1_700_000_000;

function ctx(overrides: Partial<RetryApprovalContext> = {}): RetryApprovalContext {
  return {
    retryCount: 0,
    hasCurrentApproval: true,
    approvalGrantedAt: NOW - 60,
    now: NOW,
    ...overrides,
  };
}

describe("evaluateRetryApprovalBoundaries", () => {
  it("allows retry when count is below threshold and approval is current", () => {
    const decision = evaluateRetryApprovalBoundaries(BASE_POLICY, ctx({ retryCount: 1 }));
    expect(decision.allowed).toBe(true);
    expect(decision.remainingAttempts).toBe(2);
  });

  it("blocks when retry count reaches the hard cap", () => {
    const decision = evaluateRetryApprovalBoundaries(
      BASE_POLICY,
      ctx({ retryCount: 3 }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("retries_exhausted");
    expect(decision.remainingAttempts).toBe(0);
  });

  it("blocks when re-approval threshold is reached and no current approval", () => {
    const decision = evaluateRetryApprovalBoundaries(
      BASE_POLICY,
      ctx({ retryCount: 2, hasCurrentApproval: false, approvalGrantedAt: null }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("approval_required");
    expect(decision.requiresApproval).toBe(true);
  });

  it("blocks when approval has expired", () => {
    const decision = evaluateRetryApprovalBoundaries(
      BASE_POLICY,
      ctx({
        retryCount: 2,
        hasCurrentApproval: true,
        approvalGrantedAt: NOW - 4000,
      }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("approval_expired");
  });

  it("allows retry at threshold when valid approval is present", () => {
    const decision = evaluateRetryApprovalBoundaries(
      BASE_POLICY,
      ctx({ retryCount: 2, hasCurrentApproval: true, approvalGrantedAt: NOW - 60 }),
    );
    expect(decision.allowed).toBe(true);
  });

  it("never expires when approvalTtlSeconds is 0", () => {
    const policy: RetryApprovalPolicy = { ...BASE_POLICY, approvalTtlSeconds: 0 };
    const decision = evaluateRetryApprovalBoundaries(
      policy,
      ctx({ retryCount: 0, hasCurrentApproval: true, approvalGrantedAt: NOW - 999_999 }),
    );
    expect(decision.allowed).toBe(true);
  });
});

describe("assertRetryApproved", () => {
  it("throws RetryApprovalBoundaryError when blocked", () => {
    expect(() =>
      assertRetryApproved(BASE_POLICY, ctx({ retryCount: 3 })),
    ).toThrowError(RetryApprovalBoundaryError);
  });

  it("does not throw when allowed", () => {
    expect(() =>
      assertRetryApproved(BASE_POLICY, ctx({ retryCount: 0 })),
    ).not.toThrow();
  });
});
