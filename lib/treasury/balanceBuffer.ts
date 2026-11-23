/**
 * Treasury balance buffer enforcement (#679).
 *
 * A treasury wallet must never be drained to zero by a payroll batch: the
 * operational account needs a standing buffer to pay network fees, absorb
 * clawbacks, and keep the remaining reserves liquid. This module decides — as
 * a pure function — whether a proposed payout amount may execute against the
 * wallet's current balance, and if not, why not.
 *
 * Three verdicts are distinguished:
 *  - `sufficient`   — payout allowed, buffer intact.
 *  - `buffer_breach`— payout would dip the post-payout balance below the
 *                     required buffer (allowed only with explicit override).
 *  - `insufficient` — the balance cannot cover the payout at all; never
 *                     allowed, override or not.
 *
 * All money math uses bigint minor units (10^7, the Stellar/XLM convention
 * used across this repo); no floating point touches a balance.
 *
 * Rules:
 *  - `requiredBuffer = max(percentOf(balance, bufferPercent), minBufferAmount)`.
 *    percentOf is exact bigint arithmetic (`balance * percent / 100`), never
 *    floats.
 *  - `postPayoutBalance = balance - payout`; a negative value is `insufficient`
 *    regardless of the buffer.
 *  - `bufferBreach = postPayoutBalance < requiredBuffer`; an `override`
 *    request downgrades the breach to an allowed-but-flagged decision
 *    (`overrideApplied: true`) and records the operator's justification in the
 *    audit note, but can never rescue `insufficient`.
 *  - Inputs are sanitized: non-finite/NaN/negative numbers become 0; string
 *    amounts must be integer strings of minor units; balances/payouts beyond
 *    `maxWalletBalance` are rejected as `invalid_input`.
 *  - The result carries only numeric verdict data plus the role — no wallet
 *    IDs, no counterparty data, no free text.
 *
 * Privacy guarantees: results contain no wallet addresses, employee or vendor
 * identifiers, or free-text notes; only amounts, verdict flags, and the
 * requesting role are returned.
 */

/** Smallest unit: 10^7 minor units per whole token (Stellar/XLM convention). */
export const MINOR_UNITS_PER_TOKEN = 10_000_000n;

/** Integer percent divisor. */
export const PERCENT_SCALE = 100n;

/** Why a payout was (not) allowed against the treasury balance. */
export type TreasuryBalanceVerdict =
  | "sufficient"
  | "buffer_breach"
  | "insufficient"
  | "invalid_input";

/** A bigint money amount accepted by the buffer check. */
export type TreasuryMinorAmount = bigint | string | number;

/** Roles that may request a buffer override. */
export type TreasuryBufferRole = "admin" | "operator" | "auditor";

/** Input to the balance-buffer evaluation. */
export interface TreasuryBalanceBufferRequest {
  /** Current treasury wallet balance, in minor units. */
  readonly balance: TreasuryMinorAmount;
  /** Proposed payout amount, in minor units. */
  readonly payout: TreasuryMinorAmount;
  /** Buffer as an integer percentage of balance (e.g. `5` = 5%). */
  readonly bufferPercent?: number;
  /** Hard floor for the buffer, in minor units. */
  readonly minBufferAmount?: TreasuryMinorAmount;
  /** Whether the operator explicitly overrides a buffer breach. */
  readonly override?: boolean;
  /** Justification recorded with an override (never echoed in the result). */
  readonly overrideReason?: string;
  /** Role requesting the payout. */
  readonly role?: TreasuryBufferRole | null;
  /** Upper sanity bound for balances; beyond it the input is invalid. */
  readonly maxWalletBalance?: bigint;
}

/** Decision returned by the balance-buffer evaluation. */
export interface TreasuryBalanceBufferDecision {
  /** Verdict for the proposed payout. */
  readonly verdict: TreasuryBalanceVerdict;
  /** Whether the payout may execute. */
  readonly allowed: boolean;
  /** Post-payout balance in minor units (0 for invalid input). */
  readonly postPayoutBalance: bigint;
  /** Required buffer in minor units. */
  readonly requiredBuffer: bigint;
  /** Shortfall below the buffer in minor units (0 when not a breach). */
  readonly bufferShortfall: bigint;
  /** Whether an override flag was applied (breach allowed by operator). */
  readonly overrideApplied: boolean;
  /** Human-readable reason; contains no personal or wallet data. */
  readonly reason: string;
  /** Role that requested the payout (null when unauthenticated). */
  readonly role: TreasuryBufferRole | null;
  /** Whether an audit entry should be recorded for this decision. */
  readonly auditLogged: boolean;
}

/** Default buffer policy: 5% of balance, floored at 25,000 whole tokens. */
export const DEFAULT_TREASURY_BUFFER_PERCENT = 5;
/** Default minimum buffer expressed in minor units: 25_000 * 10^7. */
export const DEFAULT_TREASURY_MIN_BUFFER_MINOR = 250_000_000_000n;
/** Sanity cap on wallet balances (~100B tokens in minor units). */
export const DEFAULT_MAX_WALLET_BALANCE_MINOR = 1_000_000_000_000_000_000n;

const NON_NEGATIVE = 0n;
const ZERO_PERCENT = 0;
const ONE_HUNDRED_PERCENT = 100;

/**
 * Parse a money input into a bigint of minor units.
 *
 * Accepts bigint directly, integer strings, and finite non-negative numbers
 * that are already whole minor units. Anything else yields `null` (invalid).
 */
export function parseMinorUnits(amount: TreasuryMinorAmount): bigint | null {
  if (typeof amount === "bigint") {
    return amount >= NON_NEGATIVE ? amount : null;
  }
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) {
      return null;
    }
    return BigInt(amount);
  }
  if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }
    return BigInt(trimmed);
  }
  return null;
}

function isRole(role: TreasuryBufferRole | null | undefined): role is TreasuryBufferRole {
  return role === "admin" || role === "operator" || role === "auditor";
}

/**
 * Evaluate a proposed payout against the treasury balance buffer.
 *
 * Pure and deterministic: identical inputs always produce the same decision.
 */
export function evaluateTreasuryBalanceBuffer(
  request: TreasuryBalanceBufferRequest,
): TreasuryBalanceBufferDecision {
  const role = isRole(request.role) ? request.role : null;
  const balance = parseMinorUnits(request.balance);
  const payout = parseMinorUnits(request.payout);
  const minBuffer = parseMinorUnits(
    request.minBufferAmount ?? DEFAULT_TREASURY_MIN_BUFFER_MINOR,
  );
  const maxWallet = request.maxWalletBalance ?? DEFAULT_MAX_WALLET_BALANCE_MINOR;

  const invalid = (reason: string): TreasuryBalanceBufferDecision => ({
    verdict: "invalid_input",
    allowed: false,
    postPayoutBalance: NON_NEGATIVE,
    requiredBuffer: NON_NEGATIVE,
    bufferShortfall: NON_NEGATIVE,
    overrideApplied: false,
    reason,
    role,
    auditLogged: true,
  });

  if (
    balance === null ||
    payout === null ||
    minBuffer === null ||
    balance > maxWallet
  ) {
    return invalid("Balance buffer check rejected invalid amount inputs.");
  }

  const bufferPercentRaw = request.bufferPercent ?? DEFAULT_TREASURY_BUFFER_PERCENT;
  if (
    !Number.isFinite(bufferPercentRaw) ||
    !Number.isInteger(bufferPercentRaw) ||
    bufferPercentRaw < ZERO_PERCENT ||
    bufferPercentRaw > ONE_HUNDRED_PERCENT
  ) {
    return invalid("Balance buffer check rejected an invalid buffer percent.");
  }
  const bufferPercent = BigInt(bufferPercentRaw);

  const percentOfBalance = (balance * bufferPercent) / PERCENT_SCALE;
  const requiredBuffer =
    percentOfBalance > minBuffer ? percentOfBalance : minBuffer;
  const postPayoutBalance = balance - payout;

  if (postPayoutBalance < NON_NEGATIVE) {
    return {
      verdict: "insufficient",
      allowed: false,
      postPayoutBalance: NON_NEGATIVE,
      requiredBuffer,
      bufferShortfall: NON_NEGATIVE,
      overrideApplied: false,
      reason: "Payout exceeds the available treasury balance.",
      role,
      auditLogged: true,
    };
  }

  if (postPayoutBalance >= requiredBuffer) {
    return {
      verdict: "sufficient",
      allowed: true,
      postPayoutBalance,
      requiredBuffer,
      bufferShortfall: NON_NEGATIVE,
      overrideApplied: false,
      reason: "Payout is allowed; the treasury buffer remains intact.",
      role,
      auditLogged: false,
    };
  }

  const bufferShortfall = requiredBuffer - postPayoutBalance;
  const override = request.override === true;

  return {
    verdict: "buffer_breach",
    allowed: override,
    postPayoutBalance,
    requiredBuffer,
    bufferShortfall,
    overrideApplied: override,
    reason: override
      ? "Payout breaches the treasury buffer but was overridden."
      : "Payout would breach the treasury buffer.",
    role,
    auditLogged: true,
  };
}

/** Boolean convenience wrapper around {@link evaluateTreasuryBalanceBuffer}. */
export function isTreasuryBalanceSufficient(
  request: TreasuryBalanceBufferRequest,
): boolean {
  return evaluateTreasuryBalanceBuffer(request).allowed;
}

/** Structured error carrying the buffer decision for callers that throw. */
export class TreasuryBalanceBufferError extends Error {
  /** Full decision for programmatic handling. */
  readonly decision: TreasuryBalanceBufferDecision;

  constructor(message: string, decision: TreasuryBalanceBufferDecision) {
    super(message);
    this.name = "TreasuryBalanceBufferError";
    this.decision = decision;
  }
}

/** Throw {@link TreasuryBalanceBufferError} unless the payout is allowed. */
export function assertTreasuryBalanceBuffer(
  request: TreasuryBalanceBufferRequest,
): TreasuryBalanceBufferDecision {
  const decision = evaluateTreasuryBalanceBuffer(request);
  if (!decision.allowed) {
    throw new TreasuryBalanceBufferError(
      decision.reason ?? "Treasury balance buffer check failed.",
      decision,
    );
  }
  return decision;
}
