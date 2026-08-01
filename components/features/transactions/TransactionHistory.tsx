"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { searchPayrollRuns } from "@/lib/payrollSearch";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Filter,
  X,
  Eye,
  Printer,
  Save,
  Bookmark,
  Pencil,
  Trash2,
  Check,
  ExternalLink,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MOCK_TRANSACTIONS, MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { PayrollTransaction } from "@/types";
import TransactionDetailDrawer from "./TransactionDetailDrawer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import StatusBadge from "@/components/ui/StatusBadge";
import { PayrollLockIndicator } from "@/components/ui/PayrollLockIndicator";

type StatusFilter = "all" | "verified" | "pending" | "failed" | "cancelled";

// Helper to determine lock state based on transaction
function getLockState(
  tx: PayrollTransaction,
): "signing" | "submission" | "confirmation" | "reconciliation" | null {
  // Mock: In real app, would check tx flags/metadata
  // For now, use status and simulate lock states
  if (tx.status === "pending") {
    // Simulate rotating lock states for pending transactions
    const hash = tx.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const states: (
      | "signing"
      | "submission"
      | "confirmation"
      | "reconciliation"
    )[] = ["signing", "submission", "confirmation", "reconciliation"];
    return states[hash % states.length];
  }
  return null;
}

interface Filters {
  /** Free-text search across run id, period, tx hash and status (#167). */
  search: string;
  status: StatusFilter;
  employee: string;
  dateFrom: string;
  dateTo: string;
  payrollRun: string;
}

interface SavedView {
  id: string;
  name: string;
  filters: Filters;
  createdAt: string;
}

const initialFilters: Filters = {
  search: "",
  status: "all",
  employee: "",
  dateFrom: "",
  dateTo: "",
  payrollRun: "",
};

function generateViewId(): string {
  return `sv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function toCsvRow(values: string[]): string {
  return values
    .map((v) => {
      const needsQuoting =
        v.includes(",") || v.includes('"') || v.includes("\n");
      return needsQuoting ? `"${v.replace(/"/g, '""')}"` : v;
    })
    .join(",");
}

function exportToCsv(rows: PayrollTransaction[]): string {
  const header = toCsvRow([
    "ID",
    "Date",
    "Status",
    "Total Amount",
    "Employees",
    "Tx Hash",
  ]);
  const body = rows
    .map((tx) =>
      toCsvRow([
        tx.id,
        new Date(tx.createdAt).toLocaleDateString(),
        tx.status,
        `${tx.totalAmount.toLocaleString()}`,
        String(tx.employeeCount),
        tx.txHash ?? "N/A",
      ]),
    )
    .join("\n");
  return `${header}\n${body}`;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface TransactionHistoryProps {
  mode?: "history" | "archived";
}

function TransactionHistoryInner({
  mode = "history",
}: TransactionHistoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<PayrollTransaction | null>(null);
  const [invalidTxId, setInvalidTxId] = useState<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const handleViewDetails = (transaction: PayrollTransaction) => {
    setSelectedTransaction(transaction);
    setInvalidTxId(null);
    setDetailDrawerOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tx", transaction.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDetailDrawerOpen(open);
    if (!open) {
      setSelectedTransaction(null);
      setInvalidTxId(null);

      const params = new URLSearchParams(searchParams.toString());
      if (params.has("tx")) {
        params.delete("tx");
        const query = params.toString();
        router.replace(`${pathname}${query ? `?${query}` : ""}`, {
          scroll: false,
        });
      }
    }
  };

  const prevTxIdRef = useRef<string | null>(null);

  useEffect(() => {
    const txId = searchParams.get("tx");
    if (txId !== prevTxIdRef.current) {
      prevTxIdRef.current = txId;
      if (txId) {
        const foundTx = MOCK_TRANSACTIONS.find((t) => t.id === txId);
        if (foundTx) {
          setSelectedTransaction(foundTx);
          setInvalidTxId(null);
        } else {
          setSelectedTransaction(null);
          setInvalidTxId(txId);
        }
        setDetailDrawerOpen(true);
      } else {
        setDetailDrawerOpen(false);
        setSelectedTransaction(null);
        setInvalidTxId(null);
      }
    }
  }, [searchParams]);

  const [isLoading, setIsLoading] = useState(
    process.env.NODE_ENV === "test" ? false : true,
  );

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const [savedViews, setSavedViews] = useLocalStorage<SavedView[]>(
    "zk-payroll-saved-views",
    [],
  );
  const [showSavedViews, setShowSavedViews] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filtered = useMemo(() => {
    let results = MOCK_TRANSACTIONS.filter((t) =>
      mode === "archived" ? t.isArchived : !t.isArchived,
    );

    // #167: applied first so the structured filters below narrow the search
    // result rather than the other way round — the counts shown next to each
    // filter then describe what the user is actually looking at.
    results = searchPayrollRuns(results, filters.search);

    if (filters.status !== "all") {
      results = results.filter((t) => t.status === filters.status);
    }

    if (filters.dateFrom) {
      results = results.filter((t) => t.createdAt >= filters.dateFrom);
    }

    if (filters.dateTo) {
      results = results.filter((t) => t.createdAt <= filters.dateTo);
    }

    if (filters.employee) {
      const match = MOCK_EMPLOYEES.find(
        (e) => e.name.toLowerCase() === filters.employee.toLowerCase(),
      );
      if (match) {
        results = results.filter((t) => t.employeeCount > 0);
      }
    }

    if (filters.payrollRun) {
      results = results.filter((t) =>
        t.id.toLowerCase().includes(filters.payrollRun.toLowerCase()),
      );
    }

    return results;
  }, [filters, mode]);

  const activeFilterCount = [
    !!filters.search.trim(),
    filters.status !== "all",
    !!filters.employee,
    !!filters.dateFrom,
    !!filters.dateTo,
    !!filters.payrollRun,
  ].filter(Boolean).length;

  const handleExport = () => {
    const csv = exportToCsv(filtered);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `payroll-history-${date}.csv`);
  };

  const clearFilters = () => setFilters(initialFilters);

  // ── Saved views handlers ────────────────────────────────────

  const handleSaveView = useCallback(() => {
    const name = savingName.trim() || `View ${savedViews.length + 1}`;
    const newView: SavedView = {
      id: generateViewId(),
      name,
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };
    setSavedViews((prev) => [...prev, newView]);
    setSavingName("");
    setShowSaveDialog(false);
  }, [savingName, filters, savedViews.length, setSavedViews]);

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters({ ...view.filters });
    setShowSavedViews(false);
  }, []);

  const handleDeleteView = useCallback(
    (id: string) => {
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
    },
    [setSavedViews],
  );

  const handleStartRename = useCallback((view: SavedView) => {
    setEditingViewId(view.id);
    setRenameValue(view.name);
  }, []);

  const handleFinishRename = useCallback(
    (id: string) => {
      const name = renameValue.trim();
      if (!name) {
        setEditingViewId(null);
        return;
      }
      setSavedViews((prev) =>
        prev.map((v) => (v.id === id ? { ...v, name } : v)),
      );
      setEditingViewId(null);
      setRenameValue("");
    },
    [renameValue, setSavedViews],
  );

  const hasFiltersApplied = activeFilterCount > 0;
  const currentView = savedViews.find(
    (v) => JSON.stringify(v.filters) === JSON.stringify(filters),
  );

  return (
    <section aria-labelledby="transaction-history-heading">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Header bar */}
        <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between gap-2">
          <h3
            id="transaction-history-heading"
            className="text-lg font-medium text-gray-900"
          >
            {mode === "archived" ? "Archived Payrolls" : "Transaction History"}
          </h3>
          <div className="flex items-center gap-2">
            {/* Saved Views dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSavedViews(!showSavedViews)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  showSavedViews
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-expanded={showSavedViews}
                aria-controls="saved-views-panel"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Saved Views
                {savedViews.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-600 text-white rounded-full">
                    {savedViews.length}
                  </span>
                )}
              </button>
              {showSavedViews && (
                <div
                  id="saved-views-panel"
                  role="menu"
                  className="absolute right-0 mt-2 w-72 rounded-xl bg-white border border-gray-200 shadow-xl z-50 py-2"
                >
                  <p className="px-4 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saved Views
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
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleFinishRename(view.id);
                                if (e.key === "Escape") setEditingViewId(null);
                              }}
                              className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              
                            />
                            <button
                              type="button"
                              onClick={() => handleFinishRename(view.id)}
                              className="p-1 text-green-600 hover:text-green-800"
                              aria-label="Save name"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyView(view)}
                            className={`flex-1 text-left text-sm truncate ${
                              currentView?.id === view.id
                                ? "font-semibold text-indigo-700"
                                : "text-gray-700"
                            }`}
                          >
                            {view.name}
                          </button>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleStartRename(view)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            aria-label={`Rename ${view.name}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteView(view.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            aria-label={`Delete ${view.name}`}
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

            {/* #167: always-visible search, separate from the collapsible
                filter panel — finding a known run should not require opening
                a panel first. */}
            <div className="relative flex-1 min-w-[12rem] max-w-sm">
              <label htmlFor="payroll-run-search" className="sr-only">
                Search payroll runs
              </label>
              <input
                id="payroll-run-search"
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
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, search: "" }))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  ×
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                showFilters
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              aria-expanded={showFilters}
              aria-controls="filter-panel"
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-indigo-600 text-white rounded-full">
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
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Audit Report
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div
            id="filter-panel"
            role="region"
            aria-label="Filter transactions"
            className="px-4 sm:px-6 py-4 bg-gray-50 border-b grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
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
                htmlFor="filter-employee"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Employee
              </label>
              <input
                id="filter-employee"
                type="text"
                placeholder="Search name..."
                value={filters.employee}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, employee: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
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
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label
                  htmlFor="filter-payroll-run"
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Payroll Run
                </label>
                <input
                  id="filter-payroll-run"
                  type="text"
                  placeholder="Run ID..."
                  value={filters.payrollRun}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, payrollRun: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                  aria-label="Clear all filters"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Active filter bar with save button ──────────────────── */}
        {hasFiltersApplied && (
          <div className="px-6 py-2 bg-indigo-50 border-b flex items-center justify-between">
            <p className="text-xs text-indigo-700">
              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}{" "}
              active
              {currentView && (
                <span className="ml-1">
                  — matching view: <strong>{currentView.name}</strong>
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {showSaveDialog ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={savingName}
                    onChange={(e) => setSavingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveView();
                      if (e.key === "Escape") {
                        setShowSaveDialog(false);
                        setSavingName("");
                      }
                    }}
                    placeholder="View name..."
                    className="w-40 rounded border border-indigo-300 px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    
                  />
                  <button
                    type="button"
                    onClick={handleSaveView}
                    className="p-1 text-indigo-600 hover:text-indigo-800"
                    aria-label="Save view"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveDialog(false);
                      setSavingName("");
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  <Save className="w-3 h-3" />
                  Save as view
                </button>
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div
            className="animate-pulse"
            role="status"
            aria-label="Loading transactions"
          >
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-400 uppercase"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-400 uppercase"
                  >
                    Recipient
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-400 uppercase"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-400 uppercase"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-400 uppercase"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-400 uppercase"
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-gray-200 rounded-full w-14"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <ul
              className="md:hidden divide-y divide-gray-100"
              aria-label="Payroll transactions"
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-gray-500">
                  {hasFiltersApplied
                    ? "No transactions match the current filters. Try broadening your filter criteria."
                    : mode === "archived"
                      ? "No archived payroll runs found. Payroll runs are archived after they are completed and superseded."
                      : "No transactions yet. Process a payroll run to populate the transaction history."}
                </li>
              ) : (
                filtered.map((tx) => (
                  <li key={tx.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          {tx.totalAmount > 0 ? (
                            <ArrowDownLeft
                              className="w-4 h-4 text-green-600 mr-2"
                              aria-hidden="true"
                            />
                          ) : (
                            <ArrowUpRight
                              className="w-4 h-4 text-red-600 mr-2"
                              aria-hidden="true"
                            />
                          )}
                          Payout · {tx.employeeCount} employees
                          {getLockState(tx) && (
                            <PayrollLockIndicator
                              lockState={getLockState(tx)}
                              showLabel={false}
                              size="sm"
                            />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          ${tx.totalAmount.toLocaleString()} ·{" "}
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={tx.status} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <a
                        href={`/payroll/runs/${tx.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        aria-label={`View full payroll run ${tx.id}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Run
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(tx);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        aria-label={`View details for transaction ${tx.id}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <table className="hidden md:table w-full text-left">
              <caption className="sr-only">
                Payroll transactions with filtering and export
              </caption>
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Recipient
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200" aria-live="polite">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-gray-500"
                    >
                      {hasFiltersApplied
                        ? "No transactions match the current filters. Try broadening your filter criteria."
                        : mode === "archived"
                          ? "No archived payroll runs found. Payroll runs are archived after they are completed and superseded."
                          : "No transactions yet. Process a payroll run to populate the transaction history."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-6 py-4 flex items-center">
                        {tx.totalAmount > 0 ? (
                          <ArrowDownLeft
                            className="w-4 h-4 text-green-600 mr-2"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowUpRight
                            className="w-4 h-4 text-red-600 mr-2"
                            aria-hidden="true"
                          />
                        )}
                        Payout
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {tx.employeeCount} employees
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        ${tx.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={tx.status} />
                        {getLockState(tx) && (
                          <div className="mt-2">
                            <PayrollLockIndicator
                              lockState={getLockState(tx)}
                              showLabel={true}
                              size="sm"
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/payroll/runs/${tx.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            aria-label={`View full payroll run ${tx.id}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Run
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(tx);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                            aria-label={`View details for transaction ${tx.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="px-4 sm:px-6 py-3 border-t text-xs text-gray-500">
              {(() => {
                const poolSize = MOCK_TRANSACTIONS.filter((t) =>
                  mode === "archived" ? t.isArchived : !t.isArchived,
                ).length;
                return `Showing ${filtered.length} of ${poolSize} ${
                  mode === "archived" ? "archived payrolls" : "transactions"
                }`;
              })()}
            </div>
          </>
        )}
      </div>

      <TransactionDetailDrawer
        transaction={selectedTransaction}
        open={detailDrawerOpen}
        onOpenChange={handleDrawerOpenChange}
        invalidTxId={invalidTxId}
      />
    </section>
  );
}

function TransactionHistory(props: TransactionHistoryProps) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse h-96 bg-gray-100 rounded-lg"></div>
      }
    >
      <TransactionHistoryInner {...props} />
    </Suspense>
  );
}

export default TransactionHistory;
