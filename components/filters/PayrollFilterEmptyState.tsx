"use client";

import type React from "react";
import { Search, SlidersHorizontal, Inbox, X, RotateCcw } from "lucide-react";
import {
  describePayrollEmptyState,
  type ActivePayrollFilter,
} from "@/src/payroll/emptyState";

/**
 * Empty state for payroll lists narrowed by search and filters (issue #464).
 *
 * Explains *why* nothing is visible — no data yet vs. a search/filter
 * combination that excludes every run — lists each active constraint as a
 * removable chip, and always offers a single "Clear all filters" reset.
 *
 * Renders labels only (see `describePayrollEmptyState`); it never receives
 * run records, so it cannot surface amounts, employees, wallets or hashes.
 */

export interface PayrollFilterEmptyStateProps {
  poolSize: number;
  search: string;
  filters: ActivePayrollFilter[];
  /** Plural noun for the list, e.g. "payroll runs" or "transactions". */
  noun?: string;
  /** Remove one constraint by key (`"search"` for the search box). */
  onRemoveFilter?: (key: string) => void;
  /** Reset search and every filter. */
  onClearAll: () => void;
  /** Copy override for the genuine no-data case (e.g. archived lists). */
  noDataDescription?: string;
  /** Extra low-emphasis actions rendered under the reset, e.g. a help link. */
  children?: React.ReactNode;
}

const REASON_ICONS = {
  "no-data": Inbox,
  search: Search,
  filters: SlidersHorizontal,
  "search-and-filters": SlidersHorizontal,
} as const;

export function PayrollFilterEmptyState({
  poolSize,
  search,
  filters,
  noun,
  onRemoveFilter,
  onClearAll,
  noDataDescription,
  children,
}: PayrollFilterEmptyStateProps) {
  const state = describePayrollEmptyState({ poolSize, search, filters, noun });
  const Icon = REASON_ICONS[state.reason];
  const isFiltered = state.reason !== "no-data";

  return (
    <div
      role="status"
      data-testid="payroll-filter-empty-state"
      data-empty-reason={state.reason}
      className="px-4 py-12 text-center"
    >
      <Icon className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden="true" />
      <h3 className="mb-1 text-sm font-semibold text-gray-900">{state.title}</h3>
      <p className="mx-auto mb-4 max-w-md text-sm text-gray-500">
        {!isFiltered && noDataDescription ? noDataDescription : state.description}
      </p>

      {isFiltered && (
        <>
          <ul
            aria-label="Active search and filters"
            className="mb-4 flex flex-wrap items-center justify-center gap-2"
          >
            {state.constraints.map((constraint) => (
              <li key={constraint.key}>
                <span
                  data-empty-constraint={constraint.key}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-gray-700"
                >
                  <span className="max-w-[14rem] truncate">{constraint.label}</span>
                  {onRemoveFilter && (
                    <button
                      type="button"
                      onClick={() => onRemoveFilter(constraint.key)}
                      aria-label={`Remove ${constraint.label}`}
                      className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Clear all filters
          </button>
        </>
      )}
      {children && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

export default PayrollFilterEmptyState;
