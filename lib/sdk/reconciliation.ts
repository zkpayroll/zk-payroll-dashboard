/**
 * Reconciliation dashboard SDK.
 *
 * Pure, privacy-safe data model and builder functions for the maintainer
 * reconciliation dashboard: period- and asset-level payroll liability
 * summaries, blocking-issue grouping (mismatches, holds, disputes, refund
 * blockers), and overall close-readiness health.
 *
 * Privacy rule: every shape here is an aggregate (per run, per asset, per
 * period). Nothing in this module accepts or exposes a single employee's
 * salary or payment amount — only totals, counts, and safe metadata.
 */

import {
  compareReservedToPayout,
  type ReservationComparison,
} from "@/lib/reconciliation/reservationComparison";

export type ReconciliationHealthStatus = "healthy" | "warning" | "blocked";

export type ReconciliationBlockerCategory =
  | "mismatches"
  | "holds"
  | "disputes"
  | "refund_blockers";

export const RECONCILIATION_BLOCKER_CATEGORIES: ReconciliationBlockerCategory[] = [
  "mismatches",
  "holds",
  "disputes",
  "refund_blockers",
];

export interface ReconciliationAsset {
  code: string;
  issuer?: string;
}

export interface ReconciliationBlocker {
  category: ReconciliationBlockerCategory;
  payrollRunId: string;
  /** Privacy-safe, human-readable explanation. Never a raw salary figure. */
  description: string;
}

/** Aggregate liability figures for one asset. Never per-employee. */
export interface ReconciliationAssetAmount {
  asset: ReconciliationAsset;
  /** Total amount owed for this asset in this scope. */
  liability: number;
  /** Amount confirmed settled on-chain. */
  settled: number;
  /** liability - settled, clamped to >= 0. */
  outstanding: number;
  /**
   * Total reserved for this asset in this run (#860). Leave undefined when no
   * reservation data is available; the run is then not compared. Only
   * meaningful per run: merged period and dashboard totals do not carry it.
   */
  reserved?: number;
}

export interface ReconciliationRunInput {
  payrollRunId: string;
  /** Privacy-safe display label — a run id or batch label, never an employee name. */
  label: string;
  /** Link to the run's own detail page, when one exists. */
  href?: string;
  status: string;
  assets: ReconciliationAssetAmount[];
  blockers: ReconciliationBlocker[];
}

export interface ReconciliationPeriodInput {
  periodId: string;
  periodLabel: string;
  runs: ReconciliationRunInput[];
}

export interface ReconciliationRunSummary extends ReconciliationRunInput {
  totalLiability: number;
  totalSettled: number;
  totalOutstanding: number;
  /** Reserved amount vs final payout, one entry per asset that has reservation data. */
  reservationChecks: ReservationComparison[];
  health: ReconciliationHealthStatus;
}

export type ReconciliationBlockersByCategory = Record<
  ReconciliationBlockerCategory,
  ReconciliationBlocker[]
>;

export interface ReconciliationPeriodSummary {
  periodId: string;
  periodLabel: string;
  totalLiability: number;
  totalSettled: number;
  totalOutstanding: number;
  assets: ReconciliationAssetAmount[];
  blockersByCategory: ReconciliationBlockersByCategory;
  totalBlockerCount: number;
  /** Every run's reservation checks, so a mismatch in one run is not averaged away. */
  reservationChecks: ReservationComparison[];
  health: ReconciliationHealthStatus;
  runs: ReconciliationRunSummary[];
}

export interface ReconciliationDashboardSummary {
  periods: ReconciliationPeriodSummary[];
  assetTotals: ReconciliationAssetAmount[];
  overallHealth: ReconciliationHealthStatus;
  totalBlockerCount: number;
}

function assetKey(asset: ReconciliationAsset): string {
  return asset.issuer ? `${asset.code}:${asset.issuer}` : asset.code;
}

/**
 * Blocked whenever any actionable blocker exists (mismatch, hold, dispute,
 * or refund blocker) — these are exactly the things that must be resolved
 * before a period can safely close. Otherwise, an unsettled balance, or a
 * reservation larger than the final payout that still has to be released, is
 * a warning (nothing actionable is blocked yet). No blockers, no outstanding
 * balance and no excess reservation is healthy.
 */
export function evaluateReconciliationHealth(
  blockerCount: number,
  outstanding: number,
  hasExcessReservation = false,
): ReconciliationHealthStatus {
  if (blockerCount > 0) return "blocked";
  if (outstanding > 0 || hasExcessReservation) return "warning";
  return "healthy";
}

/** Merge asset amounts from multiple runs/periods into per-asset totals. */
export function mergeAssetAmounts(
  groups: ReconciliationAssetAmount[][],
): ReconciliationAssetAmount[] {
  const byKey = new Map<string, ReconciliationAssetAmount>();

  for (const group of groups) {
    for (const entry of group) {
      const key = assetKey(entry.asset);
      const existing = byKey.get(key);
      if (existing) {
        existing.liability += entry.liability;
        existing.settled += entry.settled;
        existing.outstanding += entry.outstanding;
      } else {
        // `reserved` is a per-run figure and is deliberately not carried into totals.
        byKey.set(key, {
          asset: entry.asset,
          liability: entry.liability,
          settled: entry.settled,
          outstanding: entry.outstanding,
        });
      }
    }
  }

  return Array.from(byKey.values());
}

function groupBlockersByCategory(
  blockers: ReconciliationBlocker[],
): ReconciliationBlockersByCategory {
  const grouped = Object.fromEntries(
    RECONCILIATION_BLOCKER_CATEGORIES.map((category) => [category, [] as ReconciliationBlocker[]]),
  ) as ReconciliationBlockersByCategory;

  for (const blocker of blockers) {
    grouped[blocker.category].push(blocker);
  }

  return grouped;
}

export function summarizeRun(input: ReconciliationRunInput): ReconciliationRunSummary {
  const totalLiability = input.assets.reduce((sum, a) => sum + a.liability, 0);
  const totalSettled = input.assets.reduce((sum, a) => sum + a.settled, 0);
  const totalOutstanding = input.assets.reduce((sum, a) => sum + a.outstanding, 0);

  // Compare per asset: amounts in different assets must never be added together.
  const reservationChecks = input.assets
    .filter((a) => a.reserved !== undefined)
    .map((a) => compareReservedToPayout(a.asset.code, a.reserved, a.liability));

  // A payout the reservation does not cover is a mismatch that blocks closing.
  const shortfallBlockers: ReconciliationBlocker[] = reservationChecks
    .filter((c) => c.status === "under_reserved" || c.status === "invalid")
    .map((c) => ({
      category: "mismatches",
      payrollRunId: input.payrollRunId,
      description: c.message,
    }));
  const blockers = [...input.blockers, ...shortfallBlockers];
  const hasExcessReservation = reservationChecks.some((c) => c.status === "over_reserved");

  return {
    ...input,
    blockers,
    totalLiability,
    totalSettled,
    totalOutstanding,
    reservationChecks,
    health: evaluateReconciliationHealth(blockers.length, totalOutstanding, hasExcessReservation),
  };
}

export function summarizePeriod(input: ReconciliationPeriodInput): ReconciliationPeriodSummary {
  const runs = input.runs.map(summarizeRun);
  const assets = mergeAssetAmounts(runs.map((r) => r.assets));
  const allBlockers = runs.flatMap((r) => r.blockers);
  const blockersByCategory = groupBlockersByCategory(allBlockers);

  const totalLiability = runs.reduce((sum, r) => sum + r.totalLiability, 0);
  const totalSettled = runs.reduce((sum, r) => sum + r.totalSettled, 0);
  const totalOutstanding = runs.reduce((sum, r) => sum + r.totalOutstanding, 0);
  const reservationChecks = runs.flatMap((r) => r.reservationChecks);

  return {
    periodId: input.periodId,
    periodLabel: input.periodLabel,
    totalLiability,
    totalSettled,
    totalOutstanding,
    assets,
    blockersByCategory,
    totalBlockerCount: allBlockers.length,
    reservationChecks,
    health: evaluateReconciliationHealth(
      allBlockers.length,
      totalOutstanding,
      reservationChecks.some((c) => c.status === "over_reserved"),
    ),
    runs,
  };
}

/** Worst-of ordering used to roll per-period health up into one dashboard status. */
const HEALTH_SEVERITY: Record<ReconciliationHealthStatus, number> = {
  healthy: 0,
  warning: 1,
  blocked: 2,
};

export function worstHealth(statuses: ReconciliationHealthStatus[]): ReconciliationHealthStatus {
  return statuses.reduce<ReconciliationHealthStatus>(
    (worst, status) => (HEALTH_SEVERITY[status] > HEALTH_SEVERITY[worst] ? status : worst),
    "healthy",
  );
}

export function buildReconciliationDashboard(
  periodInputs: ReconciliationPeriodInput[],
): ReconciliationDashboardSummary {
  const periods = periodInputs.map(summarizePeriod);
  const assetTotals = mergeAssetAmounts(periods.map((p) => p.assets));
  const totalBlockerCount = periods.reduce((sum, p) => sum + p.totalBlockerCount, 0);

  return {
    periods,
    assetTotals,
    overallHealth: worstHealth(periods.map((p) => p.health)),
    totalBlockerCount,
  };
}
