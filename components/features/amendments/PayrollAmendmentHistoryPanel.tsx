"use client";

import React, { useState } from "react";
import {
  History,
  Search,
  Filter,
  Download,
  ShieldCheck,
  Lock,
  ChevronRight,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
} from "lucide-react";
import {
  SalaryCommitmentAmendment,
  MOCK_AMENDMENTS,
  validateAmendmentPlan,
  getAmendmentSafeDiff,
} from "@/lib/sdk/amendments";
import {
  exportAmendmentMetadata,
  AMENDMENT_PRIVACY_NOTICE,
  formatCommitmentShort,
} from "@/lib/privacy/amendments";

export interface PayrollAmendmentHistoryPanelProps {
  amendments?: SalaryCommitmentAmendment[];
  isLoading?: boolean;
  onSelectAmendment?: (amendment: SalaryCommitmentAmendment) => void;
  onExportHistory?: (format: "json" | "csv") => void;
  className?: string;
}

export function PayrollAmendmentHistoryPanel({
  amendments = MOCK_AMENDMENTS,
  isLoading = false,
  onSelectAmendment,
  onExportHistory,
  className = "",
}: PayrollAmendmentHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAmendment, setSelectedAmendment] = useState<SalaryCommitmentAmendment | null>(null);

  const filteredAmendments = amendments.filter((item) => {
    const matchesSearch =
      item.employeeReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.reason && item.reason.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || item.approvalStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleExport = (format: "json" | "csv") => {
    if (onExportHistory) {
      onExportHistory(format);
      return;
    }
    const result = exportAmendmentMetadata(filteredAmendments, format);
    const blob = new Blob([result.data], { type: result.contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" /> Pending Review
          </span>
        );
      case "blocked":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <AlertTriangle className="w-3 h-3" /> Blocked
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div
      data-testid="payroll-amendment-history-panel"
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-6 ${className}`}
    >
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Payroll Amendment History Panel</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Audit trail of authorized salary commitment revisions with privacy-safe metadata, safe reason labels, and versioning.
          </p>
        </div>

        {/* Export Toolbar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport("json")}
            data-testid="export-json-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            data-testid="export-csv-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-3.5 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
        <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Zero-Knowledge Privacy Protection: </span>
          <span>{AMENDMENT_PRIVACY_NOTICE}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="amendment-search-input"
            placeholder="Search by employee, ID or reason..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="amendment-status-filter"
            className="px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Approval Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="blocked">Blocked</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Amendments Revision List */}
      <div data-testid="amendment-history-list" className="space-y-3">
        {filteredAmendments.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg text-xs text-gray-500">
            No payroll amendments match the current filters.
          </div>
        ) : (
          filteredAmendments.map((amendment) => (
            <div
              key={amendment.id}
              data-testid={`amendment-card-${amendment.id}`}
              className="p-4 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-xs transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Rev v{amendment.previousVersion} → v{amendment.commitmentVersion}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {amendment.employeeReference}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">({amendment.id})</span>
                </div>
                <div>{getStatusBadge(amendment.approvalStatus)}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Period & Asset</span>
                  <span className="font-semibold text-gray-800">
                    {amendment.period} • {amendment.asset.code}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Requested By</span>
                  <span className="font-medium text-gray-800">{amendment.requestedBy}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase">Timestamp</span>
                  <span className="font-medium text-gray-800">
                    {new Date(amendment.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {amendment.reason && (
                <p className="text-xs text-gray-700 italic border-l-2 border-indigo-400 pl-2 py-0.5">
                  &ldquo;{amendment.reason}&rdquo;
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-indigo-700 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Hash: {formatCommitmentShort(amendment.nextCommitment)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAmendment(amendment);
                    if (onSelectAmendment) onSelectAmendment(amendment);
                  }}
                  data-testid={`view-details-btn-${amendment.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  View Details <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Details Drawer / Modal */}
      {selectedAmendment && (
        <div
          data-testid="amendment-details-drawer"
          className="fixed inset-0 bg-black/50 z-50 flex justify-end"
        >
          <div className="bg-white w-full max-w-lg h-full p-6 space-y-6 overflow-y-auto shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-gray-900">
                    Amendment Revision Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAmendment(null)}
                  data-testid="close-drawer-btn"
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status and Summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase">
                    Revision Status
                  </span>
                  {getStatusBadge(selectedAmendment.approvalStatus)}
                </div>

                <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-xs">
                  <p className="font-bold text-gray-900">
                    {selectedAmendment.employeeReference} — {selectedAmendment.period}
                  </p>
                  <p className="text-gray-600">ID: {selectedAmendment.id}</p>
                  <p className="text-gray-600">Asset: {selectedAmendment.asset.code}</p>
                </div>
              </div>

              {/* Safe Diff Fields */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Commitment Revision Diff
                </h4>
                <div className="border rounded-lg divide-y text-xs">
                  {getAmendmentSafeDiff(selectedAmendment).fields.map((field, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center">
                      <span className="text-gray-600">{field.label}</span>
                      <span className="font-mono text-gray-900 font-medium">
                        {field.before} → {field.after}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Validation & Policy check */}
              <div className="p-3 rounded-lg border bg-gray-50 space-y-1.5 text-xs">
                <h4 className="font-bold text-gray-800">Policy & Stale Validation</h4>
                <p className="text-gray-600">
                  {validateAmendmentPlan(selectedAmendment).nextSteps}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <button
                type="button"
                onClick={() => setSelectedAmendment(null)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollAmendmentHistoryPanel;
