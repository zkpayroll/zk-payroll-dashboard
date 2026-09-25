"use client";

import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Bookmark, Check, Filter, Pencil, Save, Trash2, X } from "lucide-react";
import PayrollCalendar from "./PayrollCalendar";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { PayrollRun, ReconciliationOutcome } from "@/types/models";
import { searchPayrollRuns } from "@/lib/payrollSearch";
import { resolveReconciliationStatus } from "@/lib/reconciliation/status";

type StatusFilter = "all" | "pending" | "verified" | "failed" | "cancelled";
type OutcomeFilter = "all" | ReconciliationOutcome;
import EmptyState from "@/components/ui/EmptyState";
import { useHelpDrawer, HELP_CONTENT } from "@/stores/helpDrawer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type StatusFilter = "all" | "pending" | "verified" | "failed" | "cancelled";
type OutcomeFilter = "all" | "pending" | "partial" | "complete" | "failed";
type SortField = "createdAt" | "status" | "id";
type SortDirection = "asc" | "desc";

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

interface SavedView {
  id: string;
  name: string;
  filters: Filters;
  sortField: SortField;
  sortDirection: SortDirection;
  createdAt: string;
}

const initialFilters: Filters = {
  search: "",
  status: "all",
  dateFrom: "",
  dateTo: "",
  outcome: "all",
};

function generateViewId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `payroll-view-${crypto.randomUUID()}`;
  }

  return `payroll-view-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function PayrollHistory({ runs = MOCK_PAYROLL_RUNS }: PayrollHistoryProps) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [showSavedViews, setShowSavedViews] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savedViews, setSavedViews] = useLocalStorage<SavedView[]>(
    "zk-payroll-payroll-history-saved-views",
    [],
  );
  const { openHelp } = useHelpDrawer();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

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
      results = results.filter(
        (r) => resolveReconciliationStatus(r) === filters.outcome,
        (r) => r.reconciliationStatus === filters.outcome,
      );
    }

    return [...results].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortField === "status")
        return a.status.localeCompare(b.status) * direction;
      if (sortField === "id") return a.id.localeCompare(b.id) * direction;
      return (
        (new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()) *
        direction
      );
    });
  }, [runs, filters, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredRuns.length / pageSize);

  const paginatedRuns = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRuns.slice(startIndex, startIndex + pageSize);
  }, [filteredRuns, currentPage, pageSize]);

  const activeFilterCount = [
    !!filters.search.trim(),
    filters.status !== "all",
    !!filters.dateFrom,
    !!filters.dateTo,
    filters.outcome !== "all",
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(initialFilters);

  const currentView = savedViews.find(
    (view) =>
      JSON.stringify(view.filters) === JSON.stringify(filters) &&
      view.sortField === sortField &&
      view.sortDirection === sortDirection,
  );

  const handleSaveView = () => {
    const name = savingName.trim();
    if (!name) {
      setSaveError("Enter a name for this view.");
      return;
    }
    if (
      savedViews.some((view) => view.name.toLowerCase() === name.toLowerCase())
    ) {
      setSaveError("A saved view with this name already exists.");
      return;
    }
    setSavedViews((previous) => [
      ...previous,
      {
        id: generateViewId(),
        name,
        filters: { ...filters },
        sortField,
        sortDirection,
        createdAt: new Date().toISOString(),
      },
    ]);
    setSavingName("");
    setSaveError("");
    setShowSaveDialog(false);
  };

  const handleApplyView = (view: SavedView) => {
    setFilters({ ...view.filters });
    setSortField(view.sortField);
    setSortDirection(view.sortDirection);
    setShowSavedViews(false);
  };

  const handleFinishRename = (id: string) => {
    const name = renameValue.trim();
    if (!name) {
      setSaveError("Enter a name for this view.");
      return;
    }
    if (
      savedViews.some(
        (view) =>
          view.id !== id && view.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setSaveError("A saved view with this name already exists.");
      return;
    }
    setSavedViews((previous) =>
      previous.map((view) => (view.id === id ? { ...view, name } : view)),
    );
    setEditingViewId(null);
    setRenameValue("");
    setSaveError("");
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSavedViews((visible) => !visible)}
            aria-expanded={showSavedViews}
            aria-controls="payroll-saved-views-panel"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <Bookmark className="w-3.5 h-3.5" /> Saved views
            {savedViews.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-600 text-white rounded-full">
                {savedViews.length}
              </span>
            )}
          </button>
          {showSavedViews && (
            <div
              id="payroll-saved-views-panel"
              role="menu"
              className="absolute left-0 mt-2 w-72 rounded-lg bg-white border border-gray-200 shadow-xl z-50 py-2"
            >
              <p className="px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payroll views
              </p>
              {savedViews.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400 italic">
                  No saved views yet.
                </p>
              ) : (
                savedViews.map((view) => (
                  <div
                    key={view.id}
                    role="menuitem"
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 group"
                  >
                    {editingViewId === view.id ? (
                      <div className="relative flex items-center gap-1 flex-1">
                        <input
                          value={renameValue}
                          onChange={(event) => {
                            setRenameValue(event.target.value);
                            setSaveError("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter")
                              handleFinishRename(view.id);
                            if (event.key === "Escape") {
                              setEditingViewId(null);
                              setRenameValue("");
                              setSaveError("");
                            }
                          }}
                          aria-label={`Rename ${view.name}`}
                          className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleFinishRename(view.id)}
                          aria-label="Save view name"
                          className="p-1 text-green-600"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        {saveError && (
                          <p role="alert" className="absolute left-0 top-full mt-1 text-xs text-red-700">
                            {saveError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApplyView(view)}
                        className={`flex-1 text-left text-sm truncate ${currentView?.id === view.id ? "font-semibold text-indigo-700" : "text-gray-700"}`}
                      >
                        {view.name}
                      </button>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingViewId(view.id);
                          setRenameValue(view.name);
                        }}
                        aria-label={`Rename ${view.name}`}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSavedViews((previous) =>
                            previous.filter((item) => item.id !== view.id),
                          )
                        }
                        aria-label={`Delete ${view.name}`}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setShowSaveDialog((visible) => !visible);
            setSaveError("");
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          <Save className="w-3.5 h-3.5" /> Save view
        </button>
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
            placeholder="Search run id, period, tx hash, status, reconciliation..."
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

        {showSaveDialog && (
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div>
              <label
                htmlFor="payroll-view-name"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                View name
              </label>
              <input
                id="payroll-view-name"
                value={savingName}
                onChange={(event) => {
                  setSavingName(event.target.value);
                  setSaveError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSaveView();
                }}
                placeholder="e.g. Failed runs"
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveView}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Save
            </button>
            {saveError && (
              <p role="alert" className="basis-full text-xs text-red-700">
                {saveError}
              </p>
            )}
          </div>
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
            <label
              htmlFor="filter-status"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Status
            </label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: e.target.value as StatusFilter,
                }))
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
            <label
              htmlFor="filter-outcome"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Transaction Outcome
            </label>
            <select
              id="filter-outcome"
              value={filters.outcome}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  outcome: e.target.value as OutcomeFilter,
                }))
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All outcomes</option>
              <option value="matched">Matched</option>
              <option value="pending">Pending</option>
              <option value="mismatched">Mismatched</option>
              <option value="failed">Failed</option>
              <option value="manually_reviewed">Manually reviewed</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-date-from"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              From
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="filter-date-to"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              To
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="payroll-sort-field"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Sort by
            </label>
            <select
              id="payroll-sort-field"
              value={sortField}
              onChange={(event) =>
                setSortField(event.target.value as SortField)
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="createdAt">Created date</option>
              <option value="status">Status</option>
              <option value="id">Run ID</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="payroll-sort-direction"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Order
            </label>
            <select
              id="payroll-sort-direction"
              value={sortDirection}
              onChange={(event) =>
                setSortDirection(event.target.value as SortDirection)
              }
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
          <p className="text-xs text-indigo-700">
            {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
            {filteredRuns.length === 0 &&
              " — No runs match the current filters"}
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
        <>
          <PayrollCalendar runs={paginatedRuns} />
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      aria-disabled={currentPage === 1}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-4 text-sm font-medium text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      aria-disabled={currentPage === totalPages}
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default PayrollHistory;
