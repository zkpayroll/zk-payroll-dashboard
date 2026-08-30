import type { PayrollTransaction } from "@/types/models";

/**
 * Free-text search across payroll runs (issue #167).
 *
 * Kept as a pure function so the matching rules are testable without rendering
 * the history table, and so the same predicate can back any other list that
 * needs it later.
 *
 * Searches the fields a user can actually see in the table — run id, period,
 * transaction hash and status. Notably not `proof` or `companyId`: matching on
 * a value the table never displays produces results the user cannot explain.
 */

import { formatPeriodLabel } from "@/lib/date/periodLabel";

/** Period label derived from a run's timestamp or period field, e.g. "March 2026". */
export function formatRunPeriod(tx: Pick<PayrollTransaction, "createdAt" | "timestamp">): string {
  return formatPeriodLabel(tx, { fallback: "" });
}

/**
 * True when `tx` matches `query`.
 *
 * An empty or whitespace-only query matches everything, so clearing the box
 * restores the full list rather than emptying it.
 */
export function matchesPayrollSearch(tx: PayrollTransaction, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystacks = [
    tx.id,
    tx.status,
    tx.txHash ?? "",
    formatRunPeriod(tx),
    // ISO date too, so "2026-03" works as well as "March 2026" — users paste
    // both, and supporting only one makes the box feel broken.
    (tx.createdAt || tx.timestamp || "").slice(0, 10),
  ];

  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

/** Filter a list of runs by the search query. */
export function searchPayrollRuns(
  transactions: PayrollTransaction[],
  query: string,
): PayrollTransaction[] {
  const needle = query.trim();
  if (!needle) return transactions;
  return transactions.filter((tx) => matchesPayrollSearch(tx, needle));
}
