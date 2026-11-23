import type {
  PayrollImportRollbackDecision,
  PayrollImportRollbackEvaluation,
  PayrollImportRollbackPolicy,
} from "@/types/models";

/**
 * Dashboard payout confirmation retry policy (#688).
 *
 * When a payout confirmation fails, operators may retry it. This module governs
 * whether a retry is permitted under a configurable policy: maximum attempts,
 * cooldown between attempts, and whether the payout must be confirmed before
 * retrying. It is privacy-safe: only attempt counts, timestamps, and boolean
  * flags are inspected — never salary amounts, wallet addresses, or employee
 * identities.
 *
 * Rules:
 *  1. A payout that has exceeded the maximum retry attempt count is blocked.
 *  2. After a failed attempt, a cooldown period must elapse before retrying.
 *  3. A payout that has not been confirmed may not be retried until confirmed.
 *
 * All functions are pure: they never throw on untrusted context input, never
 * mutate their arguments, and never read the clock (pass `now` instead).
 */

const MS_PER_SECOND = 1_000;

export type PayoutConfirmationRetryRejectionReason =
  | "attempts_exhausted"
  | "cooldown_active"
  | "not_confirmed"
  | "unknown";

export interface PayoutConfirmationRetryPolicy {
  /** Maximum number of retry attempts permitted. */
  maxRetryAttempts: number;
  /** Minimum seconds that must elapse between retry attempts. */
  retryCooldownSeconds: number;
  /** Whether the payout must be confirmed before a retry is allowed. */
  requireConfirmation: boolean;
}

export interface PayoutConfirmationRetryContext {
  /** Number of retry attempts already made. */
  attemptCount: number;
  /** Unix timestamp (milliseconds) of the last attempt, null if none. */
  lastAttemptAt: number | null;
  /** Whether the payout has been explicitly confirmed. */
  confirmed: boolean;
  /** Current wall-clock timestamp in milliseconds. */
  now: number;
}

export interface PayoutConfirmationRetryDecision {
  /** True when the retry is permitted. */
  allowed: boolean;
  /** Whether the payout requires confirmation before retrying. */
  requiresConfirmation: boolean;
  /** Machine-readable reason when the retry is not permitted. */
  rejectionReason?: PayoutConfirmationRetryRejectionReason;
  /** Human-readable explanation of the decision. */
  message: string;
  /** Number of attempts remaining. */
  remainingAttempts: number;
  /** Seconds until the cooldown expires, null when not applicable. */
  retryAfterSeconds?: number | null;
}

export const DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY: PayoutConfirmationRetryPolicy = {
  maxRetryAttempts: 3,
  retryCooldownSeconds: 60,
  requireConfirmation: true,
};

function normalizePolicy(
  policy: Partial<PayoutConfirmationRetryPolicy> | undefined,
): PayoutConfirmationRetryPolicy {
  return {
    maxRetryAttempts:
      policy?.maxRetryAttempts ?? DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY.maxRetryAttempts,
    retryCooldownSeconds:
      policy?.retryCooldownSeconds ?? DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY.retryCooldownSeconds,
    requireConfirmation:
      policy?.requireConfirmation ?? DEFAULT_PAYOUT_CONFIRMATION_RETRY_POLICY.requireConfirmation,
  };
}

function normalizeContext(
  context: Partial<PayoutConfirmationRetryContext> | undefined,
): PayoutConfirmationRetryContext {
  return {
    attemptCount: context?.attemptCount ?? 0,
    lastAttemptAt: context?.lastAttemptAt ?? null,
    confirmed: context?.confirmed ?? false,
    now: context?.now ?? Date.now(),
  };
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Evaluate whether a payout confirmation retry is permitted. Never throws on
 * untrusted input: missing fields are treated as safe defaults.
 */
export function evaluatePayoutConfirmationRetryPolicy(
  policy: Partial<PayoutConfirmationRetryPolicy> | undefined,
  context: Partial<PayoutConfirmationRetryContext> | undefined,
): PayoutConfirmationRetryDecision {
  const resolvedPolicy = normalizePolicy(policy);
  const resolvedContext = normalizeContext(context);

  const remainingAttempts = Math.max(
    0,
    resolvedPolicy.maxRetryAttempts - resolvedContext.attemptCount,
  );

  if (resolvedContext.attemptCount >= resolvedPolicy.maxRetryAttempts) {
    return {
      allowed: false,
      requiresConfirmation: false,
      rejectionReason: "attempts_exhausted",
      message: `This payout confirmation has used all ${resolvedPolicy.maxRetryAttempts} permitted retry attempts. An operator must re-queue it before another attempt can proceed.`,
      remainingAttempts: 0,
      retryAfterSeconds: null,
    };
  }

  // Only an explicit `confirmed: false` triggers the confirmation gate. A
  // missing context (or an omitted confirmation flag) is treated as a safe
  // default and falls through, while an explicitly withheld confirmation
  // still blocks the retry.
  if (resolvedPolicy.requireConfirmation && context?.confirmed === false) {
    return {
      allowed: false,
      requiresConfirmation: true,
      rejectionReason: "not_confirmed",
      message: `The payout confirmation has not been confirmed. Confirm the payout before retrying (attempt ${resolvedContext.attemptCount + 1} of ${resolvedPolicy.maxRetryAttempts}).`,
      remainingAttempts,
      retryAfterSeconds: null,
    };
  }

  if (resolvedContext.lastAttemptAt !== null) {
    const cooldownMs = resolvedPolicy.retryCooldownSeconds * MS_PER_SECOND;
    const elapsedMs = resolvedContext.now - resolvedContext.lastAttemptAt;
    const remainingMs = cooldownMs - elapsedMs;
    if (remainingMs > 0) {
      return {
        allowed: false,
        requiresConfirmation: false,
        rejectionReason: "cooldown_active",
        message: `A cooldown is active after the last attempt. Retry again in ${Math.ceil(remainingMs / MS_PER_SECOND)} second(s) (attempt ${resolvedContext.attemptCount + 1} of ${resolvedPolicy.maxRetryAttempts}).`,
        remainingAttempts,
        retryAfterSeconds: Math.ceil(remainingMs / MS_PER_SECOND),
      };
    }
  }

  return {
    allowed: true,
    requiresConfirmation: false,
    message: `Retry permitted — ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
    remainingAttempts,
    retryAfterSeconds: null,
  };
}

/** Thrown when a payout confirmation retry is not permitted. */
export class PayoutConfirmationRetryError extends Error {
  public readonly decision: PayoutConfirmationRetryDecision;

  constructor(message: string, decision: PayoutConfirmationRetryDecision) {
    super(message);
    this.name = "PayoutConfirmationRetryError";
    this.decision = decision;
  }
}

/**
 * Assert that a payout confirmation retry is permitted. Throws
 * {@link PayoutConfirmationRetryError} carrying the decision when not.
 */
export function assertPayoutConfirmationRetryAllowed(
  policy: Partial<PayoutConfirmationRetryPolicy> | undefined,
  context: Partial<PayoutConfirmationRetryContext> | undefined,
): PayoutConfirmationRetryDecision {
  const decision = evaluatePayoutConfirmationRetryPolicy(policy, context);
  if (!decision.allowed) {
    throw new PayoutConfirmationRetryError(decision.message, decision);
  }
  return decision;
}

export type {
  PayoutConfirmationRetryPolicy,
  PayoutConfirmationRetryContext,
  PayoutConfirmationRetryDecision,
  PayoutConfirmationRetryRejectionReason,
};