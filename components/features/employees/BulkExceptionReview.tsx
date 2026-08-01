"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCcw,
  Search,
  Filter,
  Users,
  ArrowUpDown,
  StickyNote,
} from "lucide-react";
import {
  useBulkExceptionsStore,
  type BulkException,
  type ExceptionType,
  type ExceptionStatus,
} from "@/stores/bulkExceptions";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { toast } from "sonner";

const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  invalid_wallet: "Invalid Wallet",
  inactive_record: "Inactive Record",
  duplicate_entry: "Duplicate Entry",
};

const EXCEPTION_TYPE_ICONS: Record<ExceptionType, React.ElementType> = {
  invalid_wallet: AlertCircle,
  inactive_record: XCircle,
  duplicate_entry: AlertTriangle,
};

const SEVERITY_CLASSES: Record<string, string> = {
  error: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
};

type SortField = "employeeName" | "department" | "exceptionType" | "severity" | "status";
type SortDir = "asc" | "desc";

function generateMockExceptions(): BulkException[] {
  return [
    {
      id: "exc_001",
      employeeName: "Kofi Mensah",
      employeeId: "emp_004",
      email: "kofi@example.com",
      department: "Engineering",
      walletAddress: "INVALID_ADDR_1234567890",
      exceptionType: "invalid_wallet",
      severity: "error",
      description: "Stellar address format is invalid — cannot be decoded as a valid account ID.",
      detectedAt: "2025-07-20T10:30:00Z",
      status: "pending",
    },
    {
      id: "exc_002",
      employeeName: "Ama Serwaa",
      email: "ama@example.com",
      department: "Product",
      walletAddress: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
      exceptionType: "inactive_record",
      severity: "warning",
      description: "Employee marked inactive since 2025-06-01 but still listed in active payroll batch.",
      detectedAt: "2025-07-19T14:15:00Z",
      status: "pending",
    },
    {
      id: "exc_003",
      employeeName: "Nana Owusu",
      email: "nana@example.com",
      department: "Finance",
      walletAddress: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      exceptionType: "duplicate_entry",
      severity: "warning",
      description: "Wallet address GAAZI...CCWN is shared with employee 'Kwame Asante' (emp_002). Possible duplicate.",
      detectedAt: "2025-07-18T09:45:00Z",
      status: "pending",
    },
    {
      id: "exc_004",
      employeeName: "Efua Dadzie",
      email: "efua@example.com",
      department: "Operations",
      walletAddress: "GBADRESS_NOT_ON_CHAIN_FORMAT",
      exceptionType: "invalid_wallet",
      severity: "error",
      description: "Wallet address does not match Stellar public key format (starts with G, 56 alphanumeric chars).",
      detectedAt: "2025-07-17T16:00:00Z",
      status: "resolved",
      resolvedAt: "2025-07-18T10:00:00Z",
      notes: "Employee provided corrected wallet address.",
    },
    {
      id: "exc_005",
      employeeName: "Yaw Boakye",
      email: "yaw@example.com",
      department: "Engineering",
      walletAddress: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W38",
      exceptionType: "inactive_record",
      severity: "error",
      description: "Employee resigned on 2025-05-15 but ZK commitment was not revoked — salary proof still valid.",
      detectedAt: "2025-07-16T11:30:00Z",
      status: "dismissed",
    },
    {
      id: "exc_006",
      employeeName: "Akua Afriyie",
      department: "Design",
      walletAddress: "GAC2P5KQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4X37",
      exceptionType: "duplicate_entry",
      severity: "error",
      description: "Name 'Akua Afriyie' matches two records in the bulk import file (rows 12 and 47). Possible data entry error.",
      detectedAt: "2025-07-15T08:20:00Z",
      status: "pending",
    },
  ];
}

interface NoteModalProps {
  exception: BulkException;
  onSave: (id: string, note: string) => void;
  onClose: () => void;
}

function NoteModal({ exception, onSave, onClose }: NoteModalProps) {
  const [note, setNote] = useState(exception.notes ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Add note for ${exception.employeeName}`}
      >
        <h3 className="text-base font-semibold text-gray-900">
          Note for {exception.employeeName}
        </h3>
        <div>
          <label
            htmlFor="exception-note"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Resolution notes
          </label>
          <textarea
            id="exception-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe how this exception was handled..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(exception.id, note);
              onClose();
            }}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BulkExceptionReview() {
  const {
    exceptions: storedExceptions,
    setExceptions,
    resolveException,
    dismissException,
    reopenException,
    resolveAll,
    dismissAll,
    addNote,
  } = useBulkExceptionsStore();

  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterType, setFilterType] = useState<ExceptionType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ExceptionStatus | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [noteTarget, setNoteTarget] = useState<BulkException | null>(null);
  const [initialized, setInitialized] = useState(false);

  const exceptions = useMemo(
    () => (storedExceptions.length > 0 ? storedExceptions : []),
    [storedExceptions]
  );

  useEffect(() => {
    if (!initialized && storedExceptions.length === 0) {
      setExceptions(generateMockExceptions());
      const t = setTimeout(() => setInitialized(true), 100);
      return () => clearTimeout(t);
    }
  }, [initialized, storedExceptions.length, setExceptions]);

  const pendingCount = useMemo(
    () => exceptions.filter((e) => e.status === "pending").length,
    [exceptions]
  );

  const errorCount = useMemo(
    () => exceptions.filter((e) => e.severity === "error" && e.status === "pending").length,
    [exceptions]
  );

  const filtered = useMemo(() => {
    let result = [...exceptions];

    if (filterType !== "all") {
      result = result.filter((e) => e.exceptionType === filterType);
    }
    if (filterStatus !== "all") {
      result = result.filter((e) => e.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.employeeName.toLowerCase().includes(q) ||
          e.walletAddress.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.email?.toLowerCase().includes(q) ?? false)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "employeeName") cmp = a.employeeName.localeCompare(b.employeeName);
      else if (sortField === "department")
        cmp = (a.department ?? "").localeCompare(b.department ?? "");
      else if (sortField === "exceptionType")
        cmp = a.exceptionType.localeCompare(b.exceptionType);
      else if (sortField === "severity") {
        const severityOrder = { error: 0, warning: 1 };
        cmp = severityOrder[a.severity] - severityOrder[b.severity];
      }
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [exceptions, filterType, filterStatus, searchQuery, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleResolve = useCallback(
    (id: string) => {
      resolveException(id);
      const exc = exceptions.find((e) => e.id === id);
      toast.success(`${exc?.employeeName ?? "Exception"} resolved`);
    },
    [resolveException, exceptions]
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dismissException(id);
      const exc = exceptions.find((e) => e.id === id);
      toast.info(`${exc?.employeeName ?? "Exception"} dismissed`);
    },
    [dismissException, exceptions]
  );

  const handleReopen = useCallback(
    (id: string) => {
      reopenException(id);
      toast.info("Exception reopened");
    },
    [reopenException]
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1 inline-block">
        {sortDir === "asc" ? "\u2191" : "\u2193"}
      </span>
    );
  };

  return (
    <section aria-labelledby="bulk-exception-heading">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3
                id="bulk-exception-heading"
                className="text-lg font-medium text-gray-900"
              >
                Bulk Employee Exception Review
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Review and resolve bulk employee exceptions — invalid wallets, inactive records, or duplicate entries.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {pendingCount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      resolveAll();
                      toast.success(`${pendingCount} exception${pendingCount > 1 ? "s" : ""} resolved`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Resolve all ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dismissAll();
                      toast.info(`${pendingCount} exception${pendingCount > 1 ? "s" : ""} dismissed`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-200"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Dismiss all ({pendingCount})
                  </button>
                </>
              )}
            </div>
          </div>

          {errorCount > 0 && (
            <div className="mt-3 px-3 py-2 bg-red-50 rounded-md flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-700">
                {errorCount} critical exception{errorCount > 1 ? "s" : ""} require{errorCount === 1 ? "s" : ""} immediate attention.
              </p>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search by name, wallet, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-md border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              aria-label="Search exceptions"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ExceptionType | "all")}
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              aria-label="Filter by exception type"
            >
              <option value="all">All types</option>
              <option value="invalid_wallet">Invalid Wallet</option>
              <option value="inactive_record">Inactive Record</option>
              <option value="duplicate_entry">Duplicate Entry</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ExceptionStatus | "all")}
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              aria-label="Filter by status"
            >
              <option value="pending">Pending</option>
              <option value="all">All statuses</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>

        {exceptions.length === 0 ? (
          <EmptyState
            screen="generic"
            icon={Users}
            title="No bulk exceptions detected"
            description="When bulk employee operations encounter issues, exceptions will appear here for review."
          />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              No exceptions match your filters
            </h3>
            <p className="text-sm text-gray-500">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">
                  Bulk employee exceptions table
                </caption>
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-medium text-gray-600 uppercase cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => handleSort("employeeName")}
                    >
                      Employee <SortIcon field="employeeName" />
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-medium text-gray-600 uppercase cursor-pointer select-none hover:bg-gray-100 hidden sm:table-cell"
                      onClick={() => handleSort("department")}
                    >
                      Dept <SortIcon field="department" />
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-600 uppercase hidden md:table-cell">
                      Wallet Address
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-medium text-gray-600 uppercase cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => handleSort("exceptionType")}
                    >
                      Type <SortIcon field="exceptionType" />
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-medium text-gray-600 uppercase cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => handleSort("severity")}
                    >
                      Severity <SortIcon field="severity" />
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-600 uppercase hidden lg:table-cell">
                      Description
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-xs font-medium text-gray-600 uppercase cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => handleSort("status")}
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-medium text-gray-600 uppercase text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100" aria-live="polite">
                  {filtered.map((exc) => {
                    const TypeIcon = EXCEPTION_TYPE_ICONS[exc.exceptionType];
                    return (
                      <tr
                        key={exc.id}
                        className={
                          exc.severity === "error" && exc.status === "pending"
                            ? "bg-red-50/30"
                            : exc.status !== "pending"
                              ? "bg-gray-50/50"
                              : "hover:bg-gray-50"
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {exc.employeeName}
                          </div>
                          {exc.email && (
                            <div className="text-xs text-gray-500">{exc.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                          {exc.department ?? "\u2014"}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded break-all">
                            {exc.walletAddress.length > 20
                              ? `${exc.walletAddress.slice(0, 12)}...${exc.walletAddress.slice(-6)}`
                              : exc.walletAddress}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-sm text-gray-700">
                              {EXCEPTION_TYPE_LABELS[exc.exceptionType]}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${SEVERITY_CLASSES[exc.severity]}`}
                          >
                            {exc.severity === "error" ? (
                              <AlertTriangle className="w-2.5 h-2.5" />
                            ) : (
                              <AlertCircle className="w-2.5 h-2.5" />
                            )}
                            {exc.severity === "error" ? "Error" : "Warning"}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <p className="text-xs text-gray-500 max-w-xs line-clamp-2">
                            {exc.description}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={exc.status}
                            showIcon={false}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {exc.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleResolve(exc.id)}
                                  className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors"
                                  aria-label={`Resolve ${exc.employeeName}`}
                                  title="Resolve"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismiss(exc.id)}
                                  className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                  aria-label={`Dismiss ${exc.employeeName}`}
                                  title="Dismiss"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNoteTarget(exc)}
                                  className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  aria-label={`Add note for ${exc.employeeName}`}
                                  title="Add note"
                                >
                                  <StickyNote className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {exc.status !== "pending" && (
                              <button
                                type="button"
                                onClick={() => handleReopen(exc.id)}
                                className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                aria-label={`Reopen ${exc.employeeName}`}
                                title="Reopen"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 sm:px-6 py-3 border-t text-xs text-gray-500 flex items-center justify-between">
              <span>
                {filtered.length} of {exceptions.length} exception{exceptions.length > 1 ? "s" : ""} shown ·{" "}
                {pendingCount} pending ·{" "}
                {exceptions.filter((e) => e.status === "resolved").length} resolved ·{" "}
                {exceptions.filter((e) => e.status === "dismissed").length} dismissed
              </span>
              <a
                href="/employees"
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                View employee directory &rarr;
              </a>
            </div>
          </>
        )}
      </div>

      {noteTarget && (
        <NoteModal
          exception={noteTarget}
          onSave={(id, note) => {
            addNote(id, note);
            toast.success("Note saved");
          }}
          onClose={() => setNoteTarget(null)}
        />
      )}
    </section>
  );
}
