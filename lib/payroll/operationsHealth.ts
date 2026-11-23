import type { PayrollRun } from "@/types/models";

/**
 * Payroll operations health scoring (#738).
 *
 * Combines recent payroll run outcomes and treasury funding into a single
 * 0-100 score with a status band and a list of contributing factors. Pure and
 * display-only: it never blocks, retries, or changes a run.
 */

export type PayrollHealthBand = "healthy" | "warning" | "critical";

export type PayrollHealthFactorSeverity = "critical" | "warning" | "info";

export type PayrollHealthFactorId =
  | "failed_runs"
  | "stuck_pending_runs"
  | "paused_runs"
  | "reconciliation_issues"
  | "underfunded_next_run"
  | "low_funding_buffer"
  | "funding_unavailable";

export interface PayrollHealthFactor {
  id: PayrollHealthFactorId;
  severity: PayrollHealthFactorSeverity;
  /** Points deducted from the score (0 for informational factors). */
  impact: number;
  /** Human-readable explanation, including what to do next. */
  message: string;
  action?: { label: string; href: string };
}

/** The subset of a payroll run the scorer reads. */
export type PayrollHealthRun = Pick<
  PayrollRun,
  "id" | "status" | "timestamp" | "totalAmount" | "reconciliationStatus"
>;

export interface PayrollHealthInput {
  runs: ReadonlyArray<PayrollHealthRun> | null | undefined;
  /** Treasury balance available to fund payroll, in the payroll asset. */
  treasuryBalance?: number | null;
  /** Amount the next scheduled payroll run will disburse. */
  nextRunAmount?: number | null;
  /** Reference time for age-based checks. Defaults to the current time. */
  now?: Date;
}

export interface PayrollHealthConfig {
  /** How many of the most recent runs are evaluated. */
  lookbackRuns: number;
  /** A pending run older than this is treated as stuck. */
  stalePendingHours: number;
  /** Balance below this % of the next run (but still covering it) is a warning. */
  fundingBufferPercent: number;
}

export const DEFAULT_PAYROLL_HEALTH_CONFIG: PayrollHealthConfig = {
  lookbackRuns: 10,
  stalePendingHours: 72,
  fundingBufferPercent: 150,
};

/** Score at or above which the band is healthy. */
export const PAYROLL_HEALTH_HEALTHY_MIN = 80;
/** Score at or above which the band is warning; below is critical. */
export const PAYROLL_HEALTH_WARNING_MIN = 50;

export const PAYROLL_HEALTH_BAND_LABELS: Record<PayrollHealthBand, string> = {
  healthy: "Healthy",
  warning: "Needs attention",
  critical: "Critical",
};

interface PayrollHealthBase {
  factors: PayrollHealthFactor[];
  /** Input problems that were skipped or excluded, phrased for operators. */
  issues: string[];
  runsEvaluated: number;
}

export interface PayrollHealthScored extends PayrollHealthBase {
  kind: "scored";
  score: number;
  band: PayrollHealthBand;
}

export interface PayrollHealthInsufficientData extends PayrollHealthBase {
  kind: "insufficient_data";
  score: null;
  band: null;
  reason: string;
}

export type PayrollHealthResult = PayrollHealthScored | PayrollHealthInsufficientData;

const KNOWN_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "verified",
  "failed",
  "cancelled",
  "paused",
]);

const HOUR_MS = 60 * 60 * 1000;

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 7 });
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateRuns(
  runs: PayrollHealthInput["runs"],
  issues: string[],
): Array<PayrollHealthRun & { time: number }> {
  if (runs === null || runs === undefined) return [];
  if (!Array.isArray(runs)) {
    issues.push("Payroll run data is not a list and was ignored.");
    return [];
  }

  const valid: Array<PayrollHealthRun & { time: number }> = [];
  runs.forEach((run, index) => {
    const label =
      run && typeof run.id === "string" && run.id.trim() !== ""
        ? `Payroll run ${run.id}`
        : `Payroll run at position ${index + 1}`;

    if (!run || typeof run !== "object") {
      issues.push(`${label} is empty and was excluded from the score.`);
      return;
    }
    if (!KNOWN_STATUSES.has(run.status)) {
      issues.push(`${label} has an unknown status and was excluded from the score.`);
      return;
    }
    const time = Date.parse(run.timestamp);
    if (Number.isNaN(time)) {
      issues.push(`${label} has an invalid timestamp and was excluded from the score.`);
      return;
    }
    valid.push({ ...run, time });
  });
  return valid;
}

function resolveConfig(config?: Partial<PayrollHealthConfig>): PayrollHealthConfig {
  const merged = { ...DEFAULT_PAYROLL_HEALTH_CONFIG, ...config };
  return {
    lookbackRuns:
      Number.isInteger(merged.lookbackRuns) && merged.lookbackRuns > 0
        ? merged.lookbackRuns
        : DEFAULT_PAYROLL_HEALTH_CONFIG.lookbackRuns,
    stalePendingHours: isNonNegativeFinite(merged.stalePendingHours)
      ? merged.stalePendingHours
      : DEFAULT_PAYROLL_HEALTH_CONFIG.stalePendingHours,
    fundingBufferPercent:
      isNonNegativeFinite(merged.fundingBufferPercent) && merged.fundingBufferPercent >= 100
        ? merged.fundingBufferPercent
        : DEFAULT_PAYROLL_HEALTH_CONFIG.fundingBufferPercent,
  };
}

function fundingFactors(
  input: PayrollHealthInput,
  config: PayrollHealthConfig,
  issues: string[],
): PayrollHealthFactor[] {
  const { treasuryBalance, nextRunAmount } = input;
  const balanceMissing = treasuryBalance === null || treasuryBalance === undefined;
  const nextMissing = nextRunAmount === null || nextRunAmount === undefined;

  if (!balanceMissing && !isNonNegativeFinite(treasuryBalance)) {
    issues.push("Treasury balance must be a non-negative number; funding was excluded from the score.");
  }
  if (!nextMissing && !isNonNegativeFinite(nextRunAmount)) {
    issues.push("Next payroll run amount must be a non-negative number; funding was excluded from the score.");
  }

  if (!isNonNegativeFinite(treasuryBalance) || !isNonNegativeFinite(nextRunAmount)) {
    return [
      {
        id: "funding_unavailable",
        severity: "info",
        impact: 0,
        message:
          "Treasury funding data is unavailable, so funding is not reflected in this score. Refresh the treasury balance to include it.",
        action: { label: "Open treasury", href: "/treasury" },
      },
    ];
  }

  // Nothing scheduled: there is no obligation to measure the balance against.
  if (nextRunAmount === 0) return [];

  if (treasuryBalance < nextRunAmount) {
    const shortfall = nextRunAmount - treasuryBalance;
    return [
      {
        id: "underfunded_next_run",
        severity: "critical",
        impact: 35,
        message: `Treasury balance (${formatAmount(treasuryBalance)}) covers less than the next payroll run (${formatAmount(nextRunAmount)}). Add at least ${formatAmount(shortfall)} before the run executes.`,
        action: { label: "Fund treasury", href: "/treasury" },
      },
    ];
  }

  const target = (nextRunAmount * config.fundingBufferPercent) / 100;
  if (treasuryBalance < target) {
    return [
      {
        id: "low_funding_buffer",
        severity: "warning",
        impact: 10,
        message: `Treasury balance covers the next payroll run but is below the ${config.fundingBufferPercent}% reserve target. Add ${formatAmount(target - treasuryBalance)} to restore the buffer.`,
        action: { label: "Fund treasury", href: "/treasury" },
      },
    ];
  }

  return [];
}

function bandFor(score: number, factors: PayrollHealthFactor[]): PayrollHealthBand {
  if (score < PAYROLL_HEALTH_WARNING_MIN || factors.some((f) => f.severity === "critical")) {
    return "critical";
  }
  if (score < PAYROLL_HEALTH_HEALTHY_MIN || factors.some((f) => f.severity === "warning")) {
    return "warning";
  }
  return "healthy";
}

/**
 * Scores payroll operations health from recent runs and treasury funding.
 *
 * Rules (applied to the most recent `lookbackRuns` runs):
 * - each failed run: -15 (max -45); critical when 3+ fail or half of settled runs fail
 * - each pending run older than `stalePendingHours`: -10 (max -30)
 * - each paused run: -10 (max -20)
 * - each non-cancelled run with a mismatched/failed reconciliation: -5 (max -15)
 * - balance below the next run: -35, critical
 * - balance below `fundingBufferPercent` of the next run: -10
 *
 * Returns `insufficient_data` (score `null`) when no valid runs exist, so an
 * empty or unreadable history is never reported as healthy.
 */
export function scorePayrollOperationsHealth(
  input: PayrollHealthInput,
  configOverrides?: Partial<PayrollHealthConfig>,
): PayrollHealthResult {
  const config = resolveConfig(configOverrides);
  const issues: string[] = [];
  const nowMs =
    input.now instanceof Date && !Number.isNaN(input.now.getTime())
      ? input.now.getTime()
      : Date.now();

  const recent = validateRuns(input.runs, issues)
    .sort((a, b) => b.time - a.time)
    .slice(0, config.lookbackRuns);

  const funding = fundingFactors(input, config, issues);

  if (recent.length === 0) {
    return {
      kind: "insufficient_data",
      score: null,
      band: null,
      reason:
        issues.length > 0
          ? "No valid payroll runs are available to score. Resolve the data issues below or run payroll to start tracking health."
          : "No payroll runs recorded yet. Health scoring starts after the first payroll run.",
      factors: funding,
      issues,
      runsEvaluated: 0,
    };
  }

  const factors: PayrollHealthFactor[] = [];
  const windowLabel = `the last ${recent.length} ${plural(recent.length, "run")}`;

  const failed = recent.filter((r) => r.status === "failed").length;
  const settled = recent.filter((r) => r.status === "failed" || r.status === "verified").length;
  if (failed > 0) {
    const severe = failed >= 3 || (settled > 0 && failed / settled >= 0.5);
    factors.push({
      id: "failed_runs",
      severity: severe ? "critical" : "warning",
      impact: Math.min(failed * 15, 45),
      message: `${failed} failed payroll ${plural(failed, "run")} in ${windowLabel}. Review and retry ${failed === 1 ? "it" : "them"} from the recovery center.`,
      action: { label: "Open recovery center", href: "/payroll/recovery" },
    });
  }

  const staleCutoff = nowMs - config.stalePendingHours * HOUR_MS;
  const stuck = recent.filter((r) => r.status === "pending" && r.time < staleCutoff).length;
  if (stuck > 0) {
    factors.push({
      id: "stuck_pending_runs",
      severity: "warning",
      impact: Math.min(stuck * 10, 30),
      message: `${stuck} payroll ${plural(stuck, "run has", "runs have")} been pending for more than ${config.stalePendingHours} hours. Check approvals and settlement status.`,
      action: { label: "Review approvals", href: "/payroll/approvals" },
    });
  }

  const paused = recent.filter((r) => r.status === "paused").length;
  if (paused > 0) {
    factors.push({
      id: "paused_runs",
      severity: "warning",
      impact: Math.min(paused * 10, 20),
      message: `${paused} payroll ${plural(paused, "run is", "runs are")} paused. Resume or cancel ${paused === 1 ? "it" : "them"} so employees are paid on time.`,
      action: { label: "Open operations", href: "/operations" },
    });
  }

  const unreconciled = recent.filter(
    (r) =>
      r.status !== "cancelled" &&
      (r.reconciliationStatus === "mismatched" || r.reconciliationStatus === "failed"),
  ).length;
  if (unreconciled > 0) {
    factors.push({
      id: "reconciliation_issues",
      severity: "warning",
      impact: Math.min(unreconciled * 5, 15),
      message: `${unreconciled} payroll ${plural(unreconciled, "run has", "runs have")} unresolved reconciliation discrepancies. Reconcile ${unreconciled === 1 ? "it" : "them"} before closing the period.`,
      action: { label: "Open reconciliation", href: "/payroll/reconciliation" },
    });
  }

  factors.push(...funding);

  const deducted = factors.reduce((sum, f) => sum + f.impact, 0);
  const score = Math.max(0, Math.min(100, 100 - deducted));

  // Most impactful first; critical before warning before info on ties.
  const severityRank: Record<PayrollHealthFactorSeverity, number> = { critical: 0, warning: 1, info: 2 };
  factors.sort((a, b) => b.impact - a.impact || severityRank[a.severity] - severityRank[b.severity]);

  return {
    kind: "scored",
    score,
    band: bandFor(score, factors),
    factors,
    issues,
    runsEvaluated: recent.length,
  };
}
