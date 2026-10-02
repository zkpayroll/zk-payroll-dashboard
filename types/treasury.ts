/**
 * Types for Dashboard Treasury Liquidity Reserve Monitoring (#630).
 *
 * Domain contracts describing whether the treasury holds enough of a payroll
 * asset to cover the next payroll run, and by how much.
 *
 * Amounts are accepted as `number` or decimal `string` (the dashboard's
 * existing representations) and are returned as plain decimal strings so the
 * evaluator never has to round-trip money through floating point.
 */

/**
 * Reserve health for a single payroll asset.
 *
 * - `healthy`  – balance is at or above the target reserve.
 * - `low`      – balance covers the next payroll run but is below the target.
 * - `critical` – balance cannot cover the next payroll run.
 */
export type TreasuryLiquidityReserveStatus = "healthy" | "low" | "critical";

/** Reserve statuses in declaration order, for exhaustiveness checks. */
export const TREASURY_LIQUIDITY_RESERVE_STATUSES: readonly TreasuryLiquidityReserveStatus[] =
  ["healthy", "low", "critical"] as const;

/** Human-readable label for a reserve status. */
export const TREASURY_LIQUIDITY_RESERVE_STATUS_LABELS: Record<
  TreasuryLiquidityReserveStatus,
  string
> = {
  healthy: "Healthy",
  low: "Low",
  critical: "Critical",
};

/** A treasury amount as the dashboard models it today. */
export type TreasuryAmountInput = number | string;

/**
 * How current the balance reading is.
 *
 * - `fresh`   – updated within the configured staleness window.
 * - `stale`   – last updated longer ago than the staleness window.
 * - `unknown` – no usable "last updated" timestamp is available.
 */
export type TreasuryReserveFreshness = "fresh" | "stale" | "unknown";

/** Tunable thresholds for the reserve monitor. */
export interface TreasuryLiquidityReserveConfig {
  /**
   * Target reserve as a whole-number percentage of the next payroll run
   * (150 = hold 1.5x the next run). Never below 100.
   */
  targetReservePercent: number;
  /** Age in milliseconds after which a balance reading is considered stale. */
  staleAfterMs: number;
}

/** Raw readings the monitor evaluates. */
export interface TreasuryLiquidityReserveSnapshot {
  /** Payroll asset the amounts are denominated in (e.g. `USDC`). */
  assetCode: string;
  /** Balance currently free to fund payroll. */
  balance: TreasuryAmountInput | null | undefined;
  /** Amount the next scheduled payroll run will disburse; zero or absent when nothing is scheduled. */
  nextPayrollObligation: TreasuryAmountInput | null | undefined;
  /** ISO timestamp of the last balance update, if known. */
  lastUpdated?: string | null;
}

/** Which reading failed validation. */
export type TreasuryLiquidityReserveIssueField = "balance" | "nextPayrollObligation";

export interface TreasuryLiquidityReserveIssue {
  field: TreasuryLiquidityReserveIssueField;
  /** Actionable, operator-facing explanation. */
  message: string;
}

interface TreasuryLiquidityReserveResultBase {
  assetCode: string;
  freshness: TreasuryReserveFreshness;
  /** Parsed "last updated" timestamp, or null when missing or unparseable. */
  lastUpdated: string | null;
}

/** One or both readings were unusable; no status is reported. */
export interface TreasuryLiquidityReserveInvalidResult
  extends TreasuryLiquidityReserveResultBase {
  kind: "invalid";
  issues: TreasuryLiquidityReserveIssue[];
}

/** No payroll run is scheduled, so there is nothing to measure against. */
export interface TreasuryLiquidityReserveUnscheduledResult
  extends TreasuryLiquidityReserveResultBase {
  kind: "no_scheduled_payroll";
  /** Normalized decimal string. */
  balance: string;
}

export interface TreasuryLiquidityReserveEvaluatedResult
  extends TreasuryLiquidityReserveResultBase {
  kind: "evaluated";
  status: TreasuryLiquidityReserveStatus;
  /** Normalized decimal strings. */
  balance: string;
  nextPayrollObligation: string;
  /** Balance needed to reach the target reserve. */
  targetBalance: string;
  /** Balance / obligation in basis points, rounded down (10000 = 1.0x). */
  reserveRatioBps: number;
  /** Whole payroll runs of this size the balance can fund. */
  runsCovered: number;
  /** Amount missing to cover the next run; "0" unless `critical`. */
  shortfall: string;
  /** Amount missing to reach the target reserve; "0" when `healthy`. */
  amountBelowTarget: string;
  /** Target the status was evaluated against. */
  targetReservePercent: number;
}

export type TreasuryLiquidityReserveResult =
  | TreasuryLiquidityReserveInvalidResult
  | TreasuryLiquidityReserveUnscheduledResult
  | TreasuryLiquidityReserveEvaluatedResult;
