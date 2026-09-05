"use client";

import { useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import PayrollCalendar from "./PayrollCalendar";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { PayrollRun } from "@/types/models";
import { searchPayrollRuns } from "@/lib/payrollSearch";
import EmptyState from "@/components/ui/EmptyState";
import { useHelpDrawer, HELP_CONTENT } from "@/stores/helpDrawer";

type StatusFilter = "all" | "pending" | "verified" | "failed" | "cancelled";
type OutcomeFilter = "all" | "pending" | "partial" | "complete" | "failed";

interface Filters {
  search: string;
  status: StatusFilter;
  dateFrom: string;
  dateTo: string;
  outcome: OutcomeFilter;
}

interface PayrollHistoryProps {
  runs?: PayrollRun[];
}

const initialFilters: Filters = {
  search: "",
  status: "all",
  dateFrom: "",
  dateTo: "",
  outcome: "all",
};

function PayrollHistory({ runs = MOCK_PAYROLL_RUNS }: PayrollHistoryProps) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const { openHelp } = useHelpDrawer();

  const filteredRuns = useMemo(() => {
    let results = runs;

    results = searchPayrollRuns(results, filters.search) as PayrollRun[];

    if (filters.status !== "all") {
      results = results.filter((r) => r.status === filters.status);
    }

    if (filters.dateFrom) {
      results = results.filter((r) => (r.createdAt || "") >= filters.dateFrom);
    }

    if (filters.dateTo) {
      results = results.filter((r) => (r.createdAt || "") <= filters.dateTo);
    }

    if (filters.outcome !== "all") {
      results = results.filter((r) => r.reconciliationStatus === filters.outcome);
    }

    return results;
  }, [runs, filters]);

  const activeFilterCount = [
    !!filters.search.trim(),
    filters.status !== "all",
    !!filters.dateFrom,
    !!filters.dateTo,
    filters.outcome !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(initialFilters);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <label htmlFor="payroll-history-search" className="sr-only">
            Search payroll runs
          </label>
          <input
            id="payroll-history-search"
            type="search"
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            placeholder="Search run id, period, tx hash, status..."
            className="w-full pl-3 pr-8 py-1.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          {filters.search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filter</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-600 text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            aria-label="Clear all filters"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {showFilters && (
        <div
          id="payroll-history-filter-panel"
          role="region"
          aria-label="Filter payroll runs"
          className="mb-4 px-4 sm:px-6 py-4 bg-gray-50 border rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div>
            <label htmlFor="filter-status" className="block text-xs font-medium text-gray-600 mb-1">
              Status
            </label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-outcome" className="block text-xs font-medium text-gray-600 mb-1">
              Transaction Outcome
            </label>
            <select
              id="filter-outcome"
              value={filters.outcome}
              onChange={(e) =>
                setFilters((f) => ({ ...f, outcome: e.target.value as OutcomeFilter }))
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All outcomes</option>
              <option value="complete">Complete</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-date-from" className="block text-xs font-medium text-gray-600 mb-1">
              From
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="filter-date-to" className="block text-xs font-medium text-gray-600 mb-1">
              To
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
          <p className="text-xs text-indigo-700">
            {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
            {filteredRuns.length === 0 && " — No runs match the current filters"}
          </p>
        </div>
      )}

      {/* #365 — a filtered-to-zero result used to fall through to
          PayrollCalendar's "No payroll runs yet" empty state, which is
          misleading when the account actually has runs and only the current
          filter combination excludes all of them. */}
      {runs.length > 0 && activeFilterCount > 0 && filteredRuns.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm">
          <EmptyState
            screen="history-filtered"
            action={{ label: "Clear filters", onClick: clearFilters }}
            secondaryAction={{
              label: "View payroll guide",
              onClick: () => {
                const content = HELP_CONTENT.payroll;
                if (content) openHelp("payroll", content);
              },
            }}
          />
        </div>
      ) : (
        <PayrollCalendar runs={filteredRuns} />
      )}
    </>
  );
}

export default PayrollHistory;
