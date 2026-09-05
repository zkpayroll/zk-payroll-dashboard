/**
 * Aggregates reconciliation diffs across every payroll run so operators can
 * inspect mismatches between expected payroll outcomes and recorded
 * transaction results in one place (#226), instead of opening each run's
 * detail page individually.
 *
 * Built on top of the existing `buildReconciliationDiff` / vendored SDK
 * diff generator (see `lib/reconciliation/mockObserved.ts`); this module
 * only adds cross-run filtering and grouping.
 */
import type { Employee, PayrollRun } from "@/types/models";
import type { ReconciliationDiffCategory, ReconciliationDiffEntry } from "./types";
import { buildReconciliationDiff } from "./mockObserved";

/** Diff categories that represent an actual discrepancy worth reviewing. */
const DISCREPANCY_CATEGORIES: ReconciliationDiffCategory[] = [
  "missing",
  "failed_mismatch",
  "amount_mismatch",
  "unexpected",
];

export function isDiscrepancyCategory(category: ReconciliationDiffCategory): boolean {
  return DISCREPANCY_CATEGORIES.includes(category);
}

const ALL_CATEGORIES: ReconciliationDiffCategory[] = [
  "match",
  "missing",
  "failed_mismatch",
  "amount_mismatch",
  "still_pending",
  "unexpected",
];

export interface RunDiscrepancyGroup {
  run: PayrollRun;
  discrepancies: ReconciliationDiffEntry[];
  counts: Record<ReconciliationDiffCategory, number>;
}

export interface DiscrepancyInspectorFilters {
  /** Restrict to one or more categories. Empty/undefined = all categories. */
  categories?: ReconciliationDiffCategory[];
  /** Case-insensitive substring match against run id or recipient address. */
  search?: string;
}

/**
 * Build a per-run list of reconciliation discrepancies across all runs.
 * Runs with no discrepancies are omitted.
 */
export function buildDiscrepancyInspectorData(
  runs: PayrollRun[],
  employees: Employee[],
  now?: number,
): RunDiscrepancyGroup[] {
  const employeesByRun = new Map<string, Employee[]>();

  const groups: RunDiscrepancyGroup[] = [];

  for (const run of runs) {
    const runEmployees =
      employeesByRun.get(run.id) ??
      (run.employeeIds && run.employeeIds.length > 0
        ? employees.filter((e) => run.employeeIds.includes(e.id))
        : employees);
    employeesByRun.set(run.id, runEmployees);

    if (runEmployees.length === 0) continue;

    const result = buildReconciliationDiff(run, runEmployees, now);
    const discrepancies = result.entries.filter((entry) =>
      isDiscrepancyCategory(entry.category),
    );

    if (discrepancies.length === 0) continue;

    const counts = Object.fromEntries(
      ALL_CATEGORIES.map((category) => [category, 0]),
    ) as Record<ReconciliationDiffCategory, number>;
    for (const e of discrepancies) counts[e.category]++;

    groups.push({ run, discrepancies, counts });
  }

  return groups;
}

/** Apply category + search filters to already-built discrepancy groups. */
export function filterDiscrepancyGroups(
  groups: RunDiscrepancyGroup[],
  filters: DiscrepancyInspectorFilters,
): RunDiscrepancyGroup[] {
  const search = filters.search?.trim().toLowerCase();
  const categories = filters.categories?.length ? new Set(filters.categories) : null;

  return groups
    .map((group) => {
      let discrepancies = group.discrepancies;

      if (categories) {
        discrepancies = discrepancies.filter((entry) => categories.has(entry.category));
      }

      if (search) {
        const runMatches = group.run.id.toLowerCase().includes(search);
        discrepancies = runMatches
          ? discrepancies
          : discrepancies.filter((entry) => entry.recipient.toLowerCase().includes(search));
      }

      return { ...group, discrepancies };
    })
    .filter((group) => group.discrepancies.length > 0);
}

/** Total discrepancy count across all runs, useful for a summary badge. */
export function countTotalDiscrepancies(groups: RunDiscrepancyGroup[]): number {
  return groups.reduce((sum, group) => sum + group.discrepancies.length, 0);
}
