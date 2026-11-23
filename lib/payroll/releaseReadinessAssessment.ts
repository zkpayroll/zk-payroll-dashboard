import type { PayrollTransaction } from "@/types/models";
import { derivePeriodSummary } from "../payrollPeriodSummary";

/**
 * Release readiness check result for a payroll period.
 *
 * Assesses whether a payroll release is safe to proceed based on
 * transaction state, data quality, and operational readiness.
 */
export interface ReleaseReadinessResult {
  /** Overall readiness verdict */
  ready: boolean;
  /** List of blocking issues that prevent release */
  blockers: string[];
  /** List of warnings that should be reviewed but don't block */
  warnings: string[];
  /** Contextual metrics for the assessment */
  metrics: {
    totalTransactions: number;
    draftCount: number;
    lockedCount: number;
    settledCount: number;
    cancelledCount: number;
  };
}

/**
 * Configuration options for release readiness assessment.
 */
export interface ReadinessAssessmentOptions {
  /** Minimum percentage of transactions that must be settled (0-100) */
  minSettledPercentage?: number;
  /** Maximum number of drafts allowed for release */
  maxDraftsAllowed?: number;
  /** Whether to require at least one transaction */
  requireNonEmpty?: boolean;
}

const DEFAULT_OPTIONS: Required<ReadinessAssessmentOptions> = {
  minSettledPercentage: 80,
  maxDraftsAllowed: 0,
  requireNonEmpty: true,
};

/**
 * Assesses whether a payroll period is ready for release.
 *
 * Checks for common release blockers:
 * - Outstanding draft transactions (not finalized)
 * - Insufficient settlement rate
 * - Empty payroll periods (no activity)
 *
 * Returns a structured result with blockers, warnings, and metrics
 * to guide release decisions.
 *
 * @param transactions - List of payroll transactions for the period
 * @param options - Configuration for assessment thresholds
 * @returns Assessment result with ready status and details
 *
 * @example
 * ```typescript
 * const assessment = assessReleaseReadiness(transactions, {
 *   minSettledPercentage: 90,
 *   maxDraftsAllowed: 0,
 * });
 *
 * if (!assessment.ready) {
 *   console.error("Release blocked:", assessment.blockers);
 * }
 * ```
 */
export function assessReleaseReadiness(
  transactions: PayrollTransaction[],
  options: ReadinessAssessmentOptions = {},
): ReleaseReadinessResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Derive period summary counts
  const summary = derivePeriodSummary(transactions);
  const totalTransactions = transactions.length;

  const metrics = {
    totalTransactions,
    draftCount: summary.drafts,
    lockedCount: summary.locked,
    settledCount: summary.settled,
    cancelledCount: summary.cancelled,
  };

  // Check: empty period
  if (opts.requireNonEmpty && totalTransactions === 0) {
    blockers.push("Payroll period is empty — no transactions to release");
  }

  // Check: outstanding drafts
  if (summary.drafts > opts.maxDraftsAllowed) {
    blockers.push(
      `${summary.drafts} draft transaction(s) remain — finalize or cancel before release`
    );
  }

  // Check: settlement rate
  if (totalTransactions > 0) {
    const settledPercentage = (summary.settled / totalTransactions) * 100;
    if (settledPercentage < opts.minSettledPercentage) {
      blockers.push(
        `Only ${settledPercentage.toFixed(1)}% settled (requires ${opts.minSettledPercentage}%)`
      );
    }

    // Warning: high cancellation rate
    const cancelledPercentage = (summary.cancelled / totalTransactions) * 100;
    if (cancelledPercentage > 20) {
      warnings.push(
        `High cancellation rate: ${cancelledPercentage.toFixed(1)}% of transactions cancelled`
      );
    }

    // Warning: locked transactions without settlement
    if (summary.locked > 0 && summary.settled === 0) {
      warnings.push(
        `${summary.locked} transaction(s) locked but none settled — verify execution progress`
      );
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    metrics,
  };
}

/**
 * Formats a release readiness result as a human-readable summary.
 *
 * @param result - Assessment result to format
 * @returns Multi-line string summary
 */
export function formatReadinessReport(result: ReleaseReadinessResult): string {
  const lines: string[] = [];

  lines.push(`Release Readiness: ${result.ready ? "✓ READY" : "✗ NOT READY"}`);
  lines.push("");
  lines.push(`Metrics:`);
  lines.push(`  Total: ${result.metrics.totalTransactions}`);
  lines.push(`  Settled: ${result.metrics.settledCount}`);
  lines.push(`  Locked: ${result.metrics.lockedCount}`);
  lines.push(`  Drafts: ${result.metrics.draftCount}`);
  lines.push(`  Cancelled: ${result.metrics.cancelledCount}`);

  if (result.blockers.length > 0) {
    lines.push("");
    lines.push("Blockers:");
    result.blockers.forEach((blocker) => {
      lines.push(`  ✗ ${blocker}`);
    });
  }

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    result.warnings.forEach((warning) => {
      lines.push(`  ⚠ ${warning}`);
    });
  }

  return lines.join("\n");
}
