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
 * before a period can safely close. Otherwise, an unsettled balance is a
 * warning (still settling, nothing actionable yet). No blockers and no
 * outstanding balance is healthy.
 */
export function evaluateReconciliationHealth(
  blockerCount: number,
  outstanding: number,
): ReconciliationHealthStatus {
  if (blockerCount > 0) return "blocked";
  if (outstanding > 0) return "warning";
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
        byKey.set(key, { ...entry });
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

  return {
    ...input,
    totalLiability,
    totalSettled,
    totalOutstanding,
    health: evaluateReconciliationHealth(input.blockers.length, totalOutstanding),
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

  return {
    periodId: input.periodId,
    periodLabel: input.periodLabel,
    totalLiability,
    totalSettled,
    totalOutstanding,
    assets,
    blockersByCategory,
    totalBlockerCount: allBlockers.length,
    health: evaluateReconciliationHealth(allBlockers.length, totalOutstanding),
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
