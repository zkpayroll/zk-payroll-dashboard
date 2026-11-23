/**
 * Empty-state reasoning for payroll search and filters (issue #464).
 *
 * A payroll list can be empty for two very different reasons: the account has
 * no runs yet, or it does and the current search/filter combination excludes
 * all of them. Showing "No payroll runs yet" in the second case sends users
 * off to create a run they already have, so every list resolves its empty
 * state through `describePayrollEmptyState` instead of hand-rolling copy.
 *
 * Kept as pure functions so the reasoning is testable without rendering.
 *
 * PRIVACY: the explanation only ever names filter *labels* (e.g. "Status:
 * Failed") and a truncated echo of the user's own search text. It never reads
 * run records, so no amounts, employee data, wallet addresses, proofs or
 * hashes from the underlying list can leak into the copy.
 */

import {
  QUICK_FILTER_GROUPS,
  type QuickFilterGroup,
  type QuickFilterSelection,
} from "./quickFilters";

/** One active search/filter constraint the user can see and remove. */
export interface ActivePayrollFilter {
  /** Stable key used for the per-filter remove action and test ids. */
  key: string;
  /** Human label, e.g. "Status: Failed". Must not contain payroll values. */
  label: string;
}

export type PayrollEmptyStateReason =
  | "no-data"
  | "search"
  | "filters"
  | "search-and-filters";

export interface PayrollEmptyStateInput {
  /** Records available before any search or filter is applied. */
  poolSize: number;
  /** Raw search text; whitespace-only counts as no search. */
  search: string;
  /** Structured filters (panel + quick filters), excluding the search box. */
  filters: ActivePayrollFilter[];
  /** Plural noun for the list, e.g. "payroll runs" or "transactions". */
  noun?: string;
}

export interface PayrollEmptyStateDescription {
  reason: PayrollEmptyStateReason;
  title: string;
  description: string;
  /** Constraints to render as removable chips (search first when present). */
  constraints: ActivePayrollFilter[];
}

/** Key used for the search constraint in `constraints`. */
export const SEARCH_CONSTRAINT_KEY = "search";

/** Longest search echo shown back to the user before truncation. */
export const MAX_SEARCH_ECHO_LENGTH = 32;

/**
 * Shorten the user's search text for display. Long values are usually pasted
 * identifiers (tx hashes, run ids); echoing them in full adds nothing and
 * widens what a shoulder-surfer or screenshot captures.
 */
export function formatSearchEcho(search: string): string {
  const trimmed = search.trim();
  if (trimmed.length <= MAX_SEARCH_ECHO_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_SEARCH_ECHO_LENGTH - 1)}…`;
}

export function describePayrollEmptyState({
  poolSize,
  search,
  filters,
  noun = "payroll runs",
}: PayrollEmptyStateInput): PayrollEmptyStateDescription {
  const hasSearch = search.trim().length > 0;
  const hasFilters = filters.length > 0;

  const constraints: ActivePayrollFilter[] = [
    ...(hasSearch
      ? [
          {
            key: SEARCH_CONSTRAINT_KEY,
            label: `Search: "${formatSearchEcho(search)}"`,
          },
        ]
      : []),
    ...filters,
  ];

  // Nothing to filter in the first place — this is a genuine "no data yet"
  // state even if stale filters happen to be set.
  if (poolSize === 0 || (!hasSearch && !hasFilters)) {
    return {
      reason: "no-data",
      title: `No ${noun} yet`,
      description: `There are no ${noun} to show. They will appear here once payroll has been processed.`,
      constraints,
    };
  }

  const total = `0 of ${poolSize} ${noun}`;
  const filterCount = `${filters.length} active filter${filters.length === 1 ? "" : "s"}`;

  if (hasSearch && hasFilters) {
    return {
      reason: "search-and-filters",
      title: `No ${noun} match your search and filters`,
      description: `${total} match the search combined with ${filterCount}. Remove a constraint below or clear everything to see all ${noun}.`,
      constraints,
    };
  }

  if (hasSearch) {
    return {
      reason: "search",
      title: `No ${noun} match your search`,
      description: `${total} match "${formatSearchEcho(search)}". Search looks at run ID, period, transaction hash, status and reconciliation outcome — check the spelling or try a shorter term.`,
      constraints,
    };
  }

  return {
    reason: "filters",
    title: `No ${noun} match the current filters`,
    description: `${total} match the ${filterCount}. Remove a filter below or clear all filters to see every run.`,
    constraints,
  };
}

const QUICK_FILTER_GROUP_LABELS: Record<QuickFilterGroup, string> = {
  status: "Status",
  approval: "Approval",
  risk: "Risk",
  treasury: "Treasury",
  reconciliation: "Reconciliation",
};

/** "pending_executive_approval" → "Pending executive approval". */
export function humanizeFilterValue(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Key for a quick-filter constraint, e.g. `quick:status`. */
export function quickFilterConstraintKey(group: QuickFilterGroup): string {
  return `quick:${group}`;
}

/** Active quick filters as removable constraints, in toolbar order. */
export function quickFilterConstraints(
  selection: QuickFilterSelection,
): ActivePayrollFilter[] {
  return QUICK_FILTER_GROUPS.filter((group) => selection[group] !== "all").map(
    (group) => ({
      key: quickFilterConstraintKey(group),
      label: `${QUICK_FILTER_GROUP_LABELS[group]}: ${humanizeFilterValue(String(selection[group]))}`,
    }),
  );
}
