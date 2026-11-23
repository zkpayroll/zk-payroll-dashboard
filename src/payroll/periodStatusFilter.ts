/**
 * Payroll period status filtering (issue #453).
 *
 * Lets payroll teams narrow the period list by the lifecycle status a period
 * is currently in: `draft`, `active`, `finalized`, or `archived`.
 *
 * Kept as pure functions so the matching/validation rules are testable without
 * rendering the toolbar, and so any payroll list (schedule, history, archive)
 * can reuse the same semantics.
 *
 * PRIVACY: periods carry only lifecycle metadata (id, human-readable label,
 * status, run count, updated timestamp). No amounts, employee identifiers,
 * wallet addresses, proofs, or hashes are ever read or surfaced, so the list
 * is safe to render anywhere the underlying payroll data is safe to render.
 */

export type PayrollPeriodStatus = "draft" | "active" | "finalized" | "archived";

/** Lifecycle order used for filter chips and labels. */
export const PAYROLL_PERIOD_STATUSES: readonly PayrollPeriodStatus[] = [
  "draft",
  "active",
  "finalized",
  "archived",
] as const;

export const PERIOD_STATUS_LABELS: Record<PayrollPeriodStatus, string> = {
  draft: "Draft",
  active: "Active",
  finalized: "Finalized",
  archived: "Archived",
};

/**
 * A payroll period as far as status filtering is concerned. Deliberately
 * minimal and free of any private payroll values.
 */
export interface PayrollPeriod {
  id: string;
  /** Human-readable period label, e.g. "September 2026". */
  label: string;
  status: PayrollPeriodStatus;
  /** Number of payroll runs in the period; safe aggregate count only. */
  runCount?: number;
  /** ISO timestamp of the last lifecycle change, when known. */
  updatedAt?: string;
}

/** The selected filter value. `"all"` means the list is unfiltered. */
export type PeriodStatusFilter = "all" | PayrollPeriodStatus;

export const DEFAULT_PERIOD_STATUS_FILTER: PeriodStatusFilter = "all";

/** Per-status counts, including the `"all"` total. */
export type PeriodStatusCounts = Record<PeriodStatusFilter, number>;

/** Narrow an unknown value to a known payroll period status. */
export function isPayrollPeriodStatus(
  value: unknown,
): value is PayrollPeriodStatus {
  return (
    typeof value === "string" &&
    (PAYROLL_PERIOD_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Validate a filter value that may come from an untrusted source (e.g. a URL
 * query string). Anything that is not a recognised status or `"all"` falls
 * back to the unfiltered default rather than throwing — the period list still
 * renders, which is the actionable, non-crashing failure behaviour.
 */
export function normalizePeriodStatusFilter(
  value: unknown,
): PeriodStatusFilter {
  if (value === "all") return "all";
  return isPayrollPeriodStatus(value) ? value : DEFAULT_PERIOD_STATUS_FILTER;
}

/** Count periods per status, plus the `"all"` total. */
export function countPeriodsByStatus(
  periods: readonly PayrollPeriod[],
): PeriodStatusCounts {
  const counts: PeriodStatusCounts = {
    all: 0,
    draft: 0,
    active: 0,
    finalized: 0,
    archived: 0,
  };

  for (const period of periods) {
    counts.all += 1;
    if (isPayrollPeriodStatus(period.status)) {
      counts[period.status] += 1;
    }
  }

  return counts;
}

/**
 * Narrow a period list to a single status. `"all"` returns a shallow copy so
 * callers can treat the result uniformly and never mutate the source list.
 */
export function filterPeriodsByStatus<T extends PayrollPeriod>(
  periods: readonly T[],
  filter: PeriodStatusFilter,
): T[] {
  if (filter === "all") return [...periods];
  return periods.filter((period) => period.status === filter);
}

/**
 * Privacy-safe, one-line summary of the current filter result. Only lifecycle
 * labels and counts are included.
 */
export function describePeriodFilterResult(
  counts: PeriodStatusCounts,
  filter: PeriodStatusFilter,
  filteredCount: number,
): string {
  if (filter === "all") {
    return `All ${counts.all} period${counts.all === 1 ? "" : "s"} listed`;
  }

  const label = PERIOD_STATUS_LABELS[filter];
  return `${filteredCount} ${label.toLowerCase()} period${
    filteredCount === 1 ? "" : "s"
  } — ${counts[filter]} of ${counts.all}`;
}

/**
 * Realistic demo fixture spanning every status so the filter can be exercised
 * without a backend. Contains no amounts, recipients, or other private data.
 */
export const MOCK_PAYROLL_PERIODS: readonly PayrollPeriod[] = [
  {
    id: "2026-09",
    label: "September 2026",
    status: "draft",
    runCount: 1,
    updatedAt: "2026-09-25T10:00:00Z",
  },
  {
    id: "2026-08",
    label: "August 2026",
    status: "active",
    runCount: 3,
    updatedAt: "2026-08-31T09:00:00Z",
  },
  {
    id: "2026-07",
    label: "July 2026",
    status: "finalized",
    runCount: 3,
    updatedAt: "2026-07-03T08:15:00Z",
  },
  {
    id: "2026-06",
    label: "June 2026",
    status: "archived",
    runCount: 2,
    updatedAt: "2026-06-30T18:00:00Z",
  },
  {
    id: "2026-05",
    label: "May 2026",
    status: "finalized",
    runCount: 2,
    updatedAt: "2026-05-31T17:00:00Z",
  },
];
