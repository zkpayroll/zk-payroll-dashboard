import type {
  TreasuryAmountInput,
  TreasuryLiquidityReserveConfig,
  TreasuryLiquidityReserveIssue,
  TreasuryLiquidityReserveIssueField,
  TreasuryLiquidityReserveResult,
  TreasuryLiquidityReserveSnapshot,
  TreasuryLiquidityReserveStatus,
  TreasuryReserveFreshness,
} from "@/types/treasury";

/**
 * Dashboard treasury liquidity reserve monitoring (#630).
 *
 * Answers one question for operators: does the treasury hold enough of the
 * payroll asset to cover the next payroll run, and how far is it from the
 * target reserve?
 *
 * Every threshold lives in this file. Money math runs on integer base units
 * (7 decimals, Stellar's precision) so no comparison or subtraction ever goes
 * through floating point.
 */

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** Healthy when the balance is at least this percentage of the next run. */
export const DEFAULT_TARGET_RESERVE_PERCENT = 150;
/** A target below 100% would call a treasury that cannot pay "healthy". */
export const MIN_TARGET_RESERVE_PERCENT = 100;
export const MAX_TARGET_RESERVE_PERCENT = 10_000;
/** A balance reading older than this is flagged as stale. */
export const DEFAULT_RESERVE_STALE_AFTER_MS = 15 * 60 * 1000;

/** Env key that overrides {@link DEFAULT_TARGET_RESERVE_PERCENT}. */
export const TARGET_RESERVE_PERCENT_ENV_KEY =
  "NEXT_PUBLIC_TREASURY_RESERVE_TARGET_PERCENT";

/**
 * Resolve a target reserve percentage from untrusted input (env string or
 * caller config). Anything other than a whole number within the allowed range
 * falls back to the default rather than silently loosening the threshold.
 */
export function resolveTargetReservePercent(raw: unknown): number {
  const value =
    typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < MIN_TARGET_RESERVE_PERCENT ||
    value > MAX_TARGET_RESERVE_PERCENT
  ) {
    return DEFAULT_TARGET_RESERVE_PERCENT;
  }
  return value;
}

export const TREASURY_LIQUIDITY_RESERVE_CONFIG: TreasuryLiquidityReserveConfig = {
  // Referenced statically so Next.js can inline the public env value.
  targetReservePercent: resolveTargetReservePercent(
    process.env.NEXT_PUBLIC_TREASURY_RESERVE_TARGET_PERCENT,
  ),
  staleAfterMs: DEFAULT_RESERVE_STALE_AFTER_MS,
};

// ─── Amount handling ─────────────────────────────────────────────────────────

const AMOUNT_DECIMALS = 7;
const BASE_UNITS_PER_WHOLE = BigInt(10 ** AMOUNT_DECIMALS);
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const BPS_PER_WHOLE = BigInt(10_000);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const DECIMAL_AMOUNT_REGEX = /^(\d+)(?:\.(\d+))?$/;

type AmountProblem = "missing" | "not_a_number" | "negative" | "too_precise" | "too_large";

type ParsedAmount =
  | { ok: true; units: bigint }
  | { ok: false; problem: AmountProblem };

/**
 * Convert a dashboard amount into integer base units.
 *
 * Numbers are rounded to 7 decimals (which also strips binary float noise such
 * as `0.1 + 0.2`); strings must already be plain non-negative decimals.
 */
function parseAmount(value: unknown): ParsedAmount {
  if (value === null || value === undefined) {
    return { ok: false, problem: "missing" };
  }

  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, problem: "not_a_number" };
    if (value < 0) return { ok: false, problem: "negative" };
    if (value > Number.MAX_SAFE_INTEGER) return { ok: false, problem: "too_large" };
    text = value.toFixed(AMOUNT_DECIMALS);
  } else if (typeof value === "string") {
    text = value.trim();
    if (text === "") return { ok: false, problem: "missing" };
    if (/^-\d+(\.\d+)?$/.test(text)) return { ok: false, problem: "negative" };
  } else {
    return { ok: false, problem: "not_a_number" };
  }

  const match = DECIMAL_AMOUNT_REGEX.exec(text);
  if (!match) return { ok: false, problem: "not_a_number" };

  const [, whole, fraction = ""] = match;
  if (fraction.length > AMOUNT_DECIMALS) return { ok: false, problem: "too_precise" };

  return {
    ok: true,
    units:
      BigInt(whole) * BASE_UNITS_PER_WHOLE +
      BigInt(fraction.padEnd(AMOUNT_DECIMALS, "0")),
  };
}

/** Render base units as a plain decimal string without trailing zeros. */
function unitsToDecimal(units: bigint): string {
  const whole = units / BASE_UNITS_PER_WHOLE;
  const fraction = (units % BASE_UNITS_PER_WHOLE)
    .toString()
    .padStart(AMOUNT_DECIMALS, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function toSafeNumber(value: bigint): number {
  return Number(value > MAX_SAFE ? MAX_SAFE : value);
}

const FIELD_LABELS: Record<TreasuryLiquidityReserveIssueField, string> = {
  balance: "treasury balance",
  nextPayrollObligation: "next payroll amount",
};

const FIELD_REMEDIATION: Record<TreasuryLiquidityReserveIssueField, string> = {
  balance:
    "Refresh the reading; if it stays wrong, check the treasury account on the Treasury page.",
  nextPayrollObligation:
    "Refresh the reading; if it stays wrong, review the upcoming run on the Payroll schedule.",
};

// Raw readings are never echoed back: a corrupt value is not worth displaying.
function describeProblem(
  field: TreasuryLiquidityReserveIssueField,
  problem: AmountProblem,
): string {
  const label = FIELD_LABELS[field];
  const remediation = FIELD_REMEDIATION[field];
  switch (problem) {
    case "missing":
      return `The ${label} is unavailable. ${remediation}`;
    case "negative":
      return `The ${label} is negative, which is not a valid reading. ${remediation}`;
    case "too_precise":
      return `The ${label} has more than ${AMOUNT_DECIMALS} decimal places, which Stellar assets do not support. ${remediation}`;
    case "too_large":
      return `The ${label} is too large to be evaluated safely. ${remediation}`;
    case "not_a_number":
      return `The ${label} is not a valid amount. ${remediation}`;
  }
}

function evaluateFreshness(
  lastUpdated: string | null | undefined,
  now: Date,
  staleAfterMs: number,
): { freshness: TreasuryReserveFreshness; lastUpdated: string | null } {
  if (!lastUpdated) return { freshness: "unknown", lastUpdated: null };
  const updatedAt = new Date(lastUpdated).getTime();
  if (Number.isNaN(updatedAt)) return { freshness: "unknown", lastUpdated: null };
  return {
    freshness: now.getTime() - updatedAt >= staleAfterMs ? "stale" : "fresh",
    lastUpdated,
  };
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

/**
 * Evaluate the treasury's liquidity reserve against the next payroll run.
 *
 * - `invalid` when either reading is unusable (never reported as healthy).
 * - `no_scheduled_payroll` when there is no upcoming obligation to measure.
 * - `evaluated` with `healthy` / `low` / `critical` otherwise.
 *
 * Pure: no store, DOM, or clock access beyond the injected `now`.
 */
export function evaluateTreasuryLiquidityReserve(
  snapshot: TreasuryLiquidityReserveSnapshot,
  config: Partial<TreasuryLiquidityReserveConfig> = {},
  now: Date = new Date(),
): TreasuryLiquidityReserveResult {
  const targetReservePercent = resolveTargetReservePercent(
    config.targetReservePercent ?? TREASURY_LIQUIDITY_RESERVE_CONFIG.targetReservePercent,
  );
  const staleAfterMs =
    config.staleAfterMs !== undefined &&
    Number.isFinite(config.staleAfterMs) &&
    config.staleAfterMs > 0
      ? config.staleAfterMs
      : TREASURY_LIQUIDITY_RESERVE_CONFIG.staleAfterMs;

  const base = {
    assetCode: snapshot.assetCode,
    ...evaluateFreshness(snapshot.lastUpdated, now, staleAfterMs),
  };

  const balance = parseAmount(snapshot.balance);
  // A run that is not scheduled has no amount; that is an empty state, not an error.
  const hasObligationReading =
    snapshot.nextPayrollObligation !== null &&
    snapshot.nextPayrollObligation !== undefined;
  const obligation = hasObligationReading
    ? parseAmount(snapshot.nextPayrollObligation)
    : ({ ok: true, units: ZERO } as const);

  const issues: TreasuryLiquidityReserveIssue[] = [];
  if (!balance.ok) {
    issues.push({ field: "balance", message: describeProblem("balance", balance.problem) });
  }
  if (!obligation.ok) {
    issues.push({
      field: "nextPayrollObligation",
      message: describeProblem("nextPayrollObligation", obligation.problem),
    });
  }
  if (!balance.ok || !obligation.ok) {
    return { ...base, kind: "invalid", issues };
  }

  if (obligation.units === ZERO) {
    return {
      ...base,
      kind: "no_scheduled_payroll",
      balance: unitsToDecimal(balance.units),
    };
  }

  const target = BigInt(targetReservePercent);
  // Cross-multiplied so the threshold comparisons are exact.
  const coversNextRun = balance.units >= obligation.units;
  const meetsTarget = balance.units * HUNDRED >= obligation.units * target;
  const status: TreasuryLiquidityReserveStatus = meetsTarget
    ? "healthy"
    : coversNextRun
      ? "low"
      : "critical";

  // Rounded up so reaching `targetBalance` always satisfies `meetsTarget`.
  const targetUnits = (obligation.units * target + HUNDRED - BigInt(1)) / HUNDRED;

  return {
    ...base,
    kind: "evaluated",
    status,
    balance: unitsToDecimal(balance.units),
    nextPayrollObligation: unitsToDecimal(obligation.units),
    targetBalance: unitsToDecimal(targetUnits),
    reserveRatioBps: toSafeNumber((balance.units * BPS_PER_WHOLE) / obligation.units),
    runsCovered: toSafeNumber(balance.units / obligation.units),
    shortfall: unitsToDecimal(coversNextRun ? ZERO : obligation.units - balance.units),
    amountBelowTarget: unitsToDecimal(meetsTarget ? ZERO : targetUnits - balance.units),
    targetReservePercent,
  };
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/**
 * Format a decimal amount string for display (`45000.5` → `45,000.50`)
 * without converting it back to a float.
 */
export function formatTreasuryAmount(amount: TreasuryAmountInput): string {
  const parsed = parseAmount(amount);
  if (!parsed.ok) return "—";
  const [whole, fraction] = unitsToDecimal(parsed.units).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction.padEnd(2, "0")}` : grouped;
}

/** Format a basis-point reserve ratio as a whole percentage, rounded down. */
export function formatReserveRatioPercent(reserveRatioBps: number): string {
  return `${Math.floor(reserveRatioBps / 100).toLocaleString("en-US")}%`;
}
