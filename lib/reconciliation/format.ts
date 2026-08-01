/**
 * Vendored copy of `@zk-payroll/core`'s `formatReconciliationDiff` helper
 * (added in zk-payroll-sdk PR #243). The dashboard cannot currently consume
 * `@zk-payroll/core` as an npm dependency because the SDK's published
 * `main`/`types` paths do not match its `tsc` output (rootDir inferred
 * from the include list, so `dist/` is laid out as `dist/src/...`).
 *
 * Once the SDK packaging is fixed, this file can be removed and replaced
 * with `import { formatReconciliationDiff } from "@zk-payroll/core"`. The
 * function is pure with no transitive runtime dependencies.
 */
import type {
  ReconciliationDiffCategory,
  ReconciliationDiffResult,
} from "./types";

const CATEGORY_LABELS: Record<ReconciliationDiffCategory, string> = {
  match: "match",
  missing: "missing",
  failed_mismatch: "status mismatch",
  amount_mismatch: "amount mismatch",
  still_pending: "still pending",
  unexpected: "unexpected",
};

const CATEGORY_RANK: Record<ReconciliationDiffCategory, number> = {
  unexpected: 0,
  failed_mismatch: 1,
  amount_mismatch: 2,
  missing: 3,
  still_pending: 4,
  match: 5,
};

export interface FormatReconciliationDiffOptions {
  /** Indent prefix used for each entry line. Defaults to `"  "`. */
  indent?: string;
  /** Per-line terminator. Defaults to `"\n"`. */
  newline?: string;
}

function formatCountSummary(counts: ReconciliationDiffResult["counts"]): string {
  const interesting = (Object.keys(counts) as ReconciliationDiffCategory[])
    .filter((c) => counts[c] > 0 && c !== "match" && c !== "still_pending")
    .sort((a, b) => CATEGORY_RANK[a] - CATEGORY_RANK[b]);

  const routine = counts.match + counts.still_pending;

  const parts: string[] = [];
  if (routine > 0) parts.push(`${routine} routine`);
  for (const category of interesting) {
    parts.push(`${counts[category]} ${CATEGORY_LABELS[category]}`);
  }
  return parts.length > 0 ? parts.join(", ") : "no entries";
}

/**
 * Render a `ReconciliationDiffResult` as a multi-line, grep-friendly
 * string suitable for logs, CLI output, or Slack notifications.
 */
export function formatReconciliationDiff(
  result: ReconciliationDiffResult,
  options: FormatReconciliationDiffOptions = {},
): string {
  const indent = options.indent ?? "  ";
  const newline = options.newline ?? "\n";

  const status = result.isFullyReconciled
    ? "fully reconciled"
    : "needs attention";

  const header = `reconciliation: ${status} \u2014 ${formatCountSummary(result.counts)}`;

  const sortedEntries = result.entries
    .slice()
    .sort((a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category]);

  const lines = sortedEntries.map(
    (entry) =>
      `${indent}${entry.recipient}: ${CATEGORY_LABELS[entry.category]} \u2014 ${entry.reason}`,
  );

  return lines.length > 0
    ? [header, ...lines].join(newline)
    : header + newline;
}