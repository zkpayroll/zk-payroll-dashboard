import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
  PayoutConfirmationRetryError,
  assertPayoutConfirmationRetryAllowed,
  evaluatePayoutConfirmationRetryPolicy,
} from "@/src/payroll/payoutConfirmationRetryPolicy";

describe("evaluatePayoutConfirmationRetryPolicy", () => {
  it("allows a retry when attempts remain and no cooldown", () => {
    const decision = evaluatePayoutConfirmationRetryPolicy(
      DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
      { attemptCount: 0, confirmed: true, now: Date.now() },
    );

    expect(decision.allowed).toBe(true);
    expect(decision.rejectionReason).toBeUndefined();
    expect(decision.remainingAttempts).toBe(3);
    expect(decision.message).toContain("Retry permitted");
  });

  it("blocks when attempts are exhausted", () => {
    const decision = evaluatePayoutConfirmationRetryPolicy(
      DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
      { attemptCount: 3, confirmed: true, now: Date.now() },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("attempts_exhausted");
    expect(decision.remainingAttempts).toBe(0);
    expect(decision.message).toContain("used all 3 permitted retry attempts");
  });

  it("blocks when confirmation is required but not given", () => {
    const decision = evaluatePayoutConfirmationRetryPolicy(
      DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
      { attemptCount: 0, confirmed: false, now: Date.now() },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("not_confirmed");
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.message).toContain("has not been confirmed");
  });

  it("does not require confirmation when the policy disables it", () => {
    const policy = {
      ...DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
      requireConfirmation: false,
    };
    const decision = evaluatePayoutConfirmationRetryPolicy(
      policy,
      { attemptCount: 0, confirmed: false, now: Date.now() },
    );

    expect(decision.allowed).toBe(true);
    expect(decision.rejectionReason).toBeUndefined();
  });

  it("blocks during the cooldown period", () => {
    const now = Date.now();
    const decision = evaluatePayoutConfirmationRetryPolicy(
      DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
      { attemptCount: 0, confirmed: true, lastAttemptAt: now - 30_000, now },
    );

    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe("cooldown_active");
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    expect(decision.message).toContain("cooldown is active");
  });

  it("allows after the cooldown has expired", () => {
    const now = Date.now();
    const decision = evaluatePayoutConfirmationRetryPolicy(
      DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
      { attemptCount: 0, confirmed: true, lastAttemptAt: now - 120_000, now },
    );

    expect(decision.allowed).toBe(true);
    expect(decision.rejectionReason).toBeUndefined();
  });

  it("tracks remaining attempts correctly", () => {
    const decision = evaluatePayoutConfirmationRetryPolicy(
      DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
      { attemptCount: 1, confirmed: true, now: Date.now() },
    );

    expect(decision.remainingAttempts).toBe(2);
    expect(decision.message).toContain("2 attempts remaining");
  });

  it("handles a custom max retry count", () => {
    const policy = { ...DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY, maxRetryAttempts: 5 };
    const decision = evaluatePayoutConfirmationRetryPolicy(
      policy,
      { attemptCount: 4, confirmed: true, now: Date.now() },
    );

    expect(decision.allowed).toBe(true);
    expect(decision.remainingAttempts).toBe(1);
  });

  it("handles missing context with safe defaults", () => {
    const decision = evaluatePayoutConfirmationRetryPolicy(undefined, undefined);

    expect(decision.allowed).toBe(true);
    expect(decision.remainingAttempts).toBe(DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY.maxRetryAttempts);
  });
});

describe("DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY", () => {
  it("allows 3 attempts with a 60-second cooldown and requires confirmation", () => {
    expect(DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY.maxRetryAttempts).toBe(3);
    expect(DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY.retryCooldownSeconds).toBe(60);
    expect(DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY.requireConfirmation).toBe(true);
  });
});

describe("assertPayoutConfirmationRetryAllowed", () => {
  it("returns the decision when retry is allowed", () => {
    const decision = assertPayoutConfirmationRetryAllowed(
      DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
      { attemptCount: 0, confirmed: true, now: Date.now() },
    );

    expect(decision.allowed).toBe(true);
  });

  it("throws a typed error carrying the decision when not allowed", () => {
    let thrown: unknown;
    try {
      assertPayoutConfirmationRetryAllowed(
        DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY,
        { attemptCount: 3, confirmed: true, now: Date.now() },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PayoutConfirmationRetryError);
    const error = thrown as PayoutConfirmationRetryError;
    expect(error.name).toBe("PayoutConfirmationRetryError");
    expect(error.decision.rejectionReason).toBe("attempts_exhausted");
    expect(error.message).toContain("used all 3 permitted retry attempts");
  });
});