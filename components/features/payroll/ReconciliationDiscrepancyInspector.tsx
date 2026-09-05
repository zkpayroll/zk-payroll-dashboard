"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Search, FileSearch } from "lucide-react";
import { MOCK_EMPLOYEES, MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import {
  buildDiscrepancyInspectorData,
  countTotalDiscrepancies,
  filterDiscrepancyGroups,
} from "@/lib/reconciliation/discrepancyInspector";
import { formatReconciliationDiff } from "@/lib/reconciliation/format";
import type { ReconciliationDiffCategory } from "@/lib/reconciliation/types";
import type { Employee, PayrollRun } from "@/types/models";

const CATEGORY_OPTIONS: Array<{ value: ReconciliationDiffCategory; label: string }> = [
  { value: "missing", label: "Missing" },
  { value: "failed_mismatch", label: "Status mismatch" },
  { value: "amount_mismatch", label: "Amount mismatch" },
  { value: "unexpected", label: "Unexpected" },
];

const CATEGORY_BADGE_STYLES: Record<ReconciliationDiffCategory, string> = {
  match: "bg-green-50 text-green-700 border-green-200",
  still_pending: "bg-gray-50 text-gray-700 border-gray-200",
  missing: "bg-amber-50 text-amber-700 border-amber-200",
  failed_mismatch: "bg-red-50 text-red-700 border-red-200",
  amount_mismatch: "bg-orange-50 text-orange-700 border-orange-200",
  unexpected: "bg-purple-50 text-purple-700 border-purple-200",
};

export interface ReconciliationDiscrepancyInspectorProps {
  runs?: PayrollRun[];
  employees?: Employee[];
  now?: number;
}

export default function ReconciliationDiscrepancyInspector({
  runs = MOCK_PAYROLL_RUNS,
  employees = MOCK_EMPLOYEES,
  now,
}: ReconciliationDiscrepancyInspectorProps) {
  const [activeCategories, setActiveCategories] = useState<ReconciliationDiffCategory[]>([]);
  const [search, setSearch] = useState("");

  const allGroups = useMemo(
    () => buildDiscrepancyInspectorData(runs, employees, now),
    [runs, employees, now],
  );

  const visibleGroups = useMemo(
    () => filterDiscrepancyGroups(allGroups, { categories: activeCategories, search }),
    [allGroups, activeCategories, search],
  );

  const totalDiscrepancies = countTotalDiscrepancies(allGroups);
  const visibleDiscrepancies = countTotalDiscrepancies(visibleGroups);

  function toggleCategory(category: ReconciliationDiffCategory) {
    setActiveCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  }

  return (
    <section
      aria-labelledby="discrepancy-inspector-heading"
      className="rounded-lg bg-white p-6 shadow-sm"
      data-testid="reconciliation-discrepancy-inspector"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="discrepancy-inspector-heading"
            className="flex items-center gap-2 text-base font-semibold text-gray-900"
          >
            <FileSearch className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            Reconciliation discrepancy inspector
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Mismatches between expected payroll outcomes and recorded transaction results,
            across every run.
          </p>
        </div>
        <span
          className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700"
          data-testid="discrepancy-total-count"
        >
          {totalDiscrepancies} discrepanc{totalDiscrepancies === 1 ? "y" : "ies"}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {CATEGORY_OPTIONS.map((option) => {
            const isActive = activeCategories.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleCategory(option.value)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <label className="relative block sm:w-64">
          <span className="sr-only">Search by run ID or recipient address</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search run ID or recipient…"
            className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </label>
      </div>

      {totalDiscrepancies === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No discrepancies found — every run reconciles cleanly.
        </p>
      ) : visibleDiscrepancies === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No discrepancies match the current filters.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {visibleGroups.map((group) => (
            <div key={group.run.id} className="rounded-lg border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-900">Run {group.run.id}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(group.run.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      formatReconciliationDiff({
                        entries: group.discrepancies,
                        counts: group.counts,
                        isFullyReconciled: false,
                        generatedAt: now ?? Date.now(),
                      }),
                    )
                  }
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Copy diff
                </button>
              </div>
              <ul className="divide-y divide-gray-100" aria-label={`Discrepancies for run ${group.run.id}`}>
                {group.discrepancies.map((entry, idx) => (
                  <li key={`${entry.recipient}-${idx}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{entry.recipient}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{entry.reason}</p>
                    </div>
                    <span
                      className={`shrink-0 self-start rounded-full border px-2 py-0.5 text-xs font-medium sm:self-center ${CATEGORY_BADGE_STYLES[entry.category]}`}
                    >
                      {CATEGORY_OPTIONS.find((o) => o.value === entry.category)?.label ?? entry.category}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
