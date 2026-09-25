"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Archive,
  Search,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  RefreshCw,
  X,
  FileCheck,
  Building2,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { useArchiveStore } from "@/stores/archive";
import type { ArchivedPayrollRun, ArchivedRunStatus, AuditAvailability } from "@/stores/archive";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/EmptyState";

export default function PayrollArchiveCenter() {
  const {
    runs,
    searchQuery,
    periodFilter,
    assetFilter,
    employerFilter,
    statusFilter,
    auditFilter,
    hidePrivateData,
    setSearchQuery,
    setPeriodFilter,
    setAssetFilter,
    setEmployerFilter,
    setStatusFilter,
    setAuditFilter,
    toggleHidePrivateData,
    archiveRun,
    unarchiveRun,
    getFilteredRuns,
    resetFilters,
  } = useArchiveStore();

  const [copiedTxHash, setCopiedTxHash] = useState<string | null>(null);

  const filteredRuns = getFilteredRuns();



  // Derived filter dropdown options
  const periods = useMemo(() => {
    const set = new Set(runs.map((r) => r.payPeriod));
    return Array.from(set).sort().reverse();
  }, [runs]);

  const assets = useMemo(() => {
    const set = new Set(runs.map((r) => r.asset));
    return Array.from(set).sort();
  }, [runs]);

  const employers = useMemo(() => {
    const set = new Set(runs.map((r) => r.employerName));
    return Array.from(set).sort();
  }, [runs]);

  // Metrics
  const totalArchivedCount = useMemo(
    () => runs.filter((r) => r.isArchived).length,
    [runs]
  );
  const disputedCount = useMemo(
    () => runs.filter((r) => r.isDisputed).length,
    [runs]
  );
  const auditAvailableCount = useMemo(
    () => runs.filter((r) => r.auditAvailability === "available").length,
    [runs]
  );
  const totalAmountSum = useMemo(
    () => runs.reduce((acc, r) => acc + r.totalAmount, 0),
    [runs]
  );

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (periodFilter !== "all" ? 1 : 0) +
    (assetFilter !== "all" ? 1 : 0) +
    (employerFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (auditFilter !== "all" ? 1 : 0);

  const handleCopyTxHash = async (txHash: string) => {
    await navigator.clipboard.writeText(txHash);
    setCopiedTxHash(txHash);
    toast.success("Transaction Hash Copied", {
      description: "Copied transaction hash to system clipboard.",
    });
    setTimeout(() => setCopiedTxHash(null), 2000);
  };

  const handleArchiveToggle = (run: ArchivedPayrollRun) => {
    if (run.isDisputed) {
      toast.error("Disputed Run Cannot Be Archived", {
        description:
          "Disputed payroll runs are unsafe to archive until compliance issues are resolved.",
      });
      return;
    }

    if (run.isArchived) {
      unarchiveRun(run.id);
      toast.info("Payroll Run Unarchived", {
        description: `Run ${run.payrollRunId} moved back to active operations.`,
      });
    } else {
      const success = archiveRun(run.id);
      if (success) {
        toast.success("Payroll Run Archived", {
          description: `Run ${run.payrollRunId} safely stored in the archive center.`,
        });
      } else {
        toast.error("Archive Action Failed", {
          description: "Could not archive payroll run.",
        });
      }
    }
  };

  const getStatusBadgeClass = (status: ArchivedRunStatus) => {
    switch (status) {
      case "archived":
        return "bg-slate-100 text-slate-800 border-slate-300";
      case "finalized":
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case "verified":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "disputed":
        return "bg-rose-100 text-rose-800 border-rose-300 animate-pulse";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getAuditBadgeClass = (availability: AuditAvailability) => {
    switch (availability) {
      case "available":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "unavailable":
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  return (
    <div
      className="space-y-6 animate-in fade-in duration-300"
      data-testid="payroll-archive-center"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-xl text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                <Archive className="w-3.5 h-3.5" />
                Historic Operational Archive
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-medium">
                Segregated from Active Operational Payroll
              </span>
            </div>
            <h2 className="text-2xl font-bold mt-2">Payroll Run Archive Center</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Find, filter, and audit finalized payroll runs. Keeps active operational
              dashboards focused while ensuring historical records remain findable,
              tamper-proof, and audit-ready.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={toggleHidePrivateData}
              variant="outline"
              className={`text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 border shadow-sm transition-colors ${
                hidePrivateData
                  ? "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                  : "bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30"
              }`}
              title={hidePrivateData ? "Private values hidden by default" : "Private values visible"}
            >
              {hidePrivateData ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Private Values Hidden</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>Private Values Visible</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Archived */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>ARCHIVED RUNS</span>
            <Archive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {totalArchivedCount}
            </span>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              {runs.length} Total Records
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Separated from active operational dashboard
          </p>
        </div>

        {/* Audit Packets Available */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>AUDIT PACKETS AVAILABLE</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {auditAvailableCount}
            </span>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Audit-Ready
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Linked to zero-knowledge evidence bundles
          </p>
        </div>

        {/* Total Disbursement Sum */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>TOTAL ARCHIVED DISBURSEMENT</span>
            <Lock className="w-4 h-4 text-slate-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {hidePrivateData ? "••••••••" : `$${totalAmountSum.toLocaleString()}`}
            </span>
            {hidePrivateData && (
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                Redacted
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500">
            {hidePrivateData
              ? "Private salary data hidden by default"
              : "Unmasked total disbursement value"}
          </p>
        </div>

        {/* Disputed Runs */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>DISPUTED RUNS</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-700">
              {disputedCount}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                disputedCount > 0
                  ? "text-rose-700 bg-rose-50 border-rose-200 font-bold"
                  : "text-gray-600 bg-gray-50 border-gray-200"
              }`}
            >
              {disputedCount > 0 ? "Not Safe To Archive" : "All Clear"}
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            {disputedCount > 0
              ? "Requires compliance resolution before archiving"
              : "No active dispute holds"}
          </p>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by run ID, employer, period, asset, or tx hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              aria-label="Search archived payroll runs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Filter Counter & Clear Button */}
          <div className="flex items-center gap-2 shrink-0">
            {activeFilterCount > 0 && (
              <>
                <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-full border border-indigo-200 flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                </span>
                <Button
                  onClick={resetFilters}
                  variant="ghost"
                  className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 h-auto"
                >
                  Clear all filters
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-gray-100">
          {/* Period Filter */}
          <div>
            <label htmlFor="period-filter" className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Period
            </label>
            <select
              id="period-filter"
              aria-label="Filter by pay period"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Periods</option>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Asset Filter */}
          <div>
            <label htmlFor="asset-filter" className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Asset
            </label>
            <select
              id="asset-filter"
              aria-label="Filter by asset"
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Assets</option>
              {assets.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Employer Filter */}
          <div>
            <label htmlFor="employer-filter" className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Employer
            </label>
            <select
              id="employer-filter"
              aria-label="Filter by employer"
              value={employerFilter}
              onChange={(e) => setEmployerFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Employers</option>
              {employers.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status-filter" className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              id="status-filter"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ArchivedRunStatus | "all")}
              className="w-full text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="archived">Archived</option>
              <option value="finalized">Finalized</option>
              <option value="verified">Verified</option>
              <option value="disputed">Disputed</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Audit Availability Filter */}
          <div>
            <label htmlFor="audit-filter" className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Audit Availability
            </label>
            <select
              id="audit-filter"
              aria-label="Filter by audit availability"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value as AuditAvailability | "all")}
              className="w-full text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All Audit Statuses</option>
              <option value="available">Available (Audit Packet Ready)</option>
              <option value="pending">Pending Audit Review</option>
              <option value="unavailable">Unavailable (Legacy)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Runs List */}
      <div className="space-y-4">
        {filteredRuns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
            <EmptyState
              icon={Archive}
              title="No archived payroll runs match filters"
              description="Try clearing your search query or adjusting period, asset, employer, status, or audit availability filters."
              action={{
                label: "Clear all filters",
                onClick: resetFilters,
              }}
            />
          </div>
        ) : (
          filteredRuns.map((run) => (
            <div
              key={run.id}
              className={`bg-white rounded-xl border transition-all shadow-sm overflow-hidden ${
                run.isDisputed
                  ? "border-rose-300 ring-1 ring-rose-300/50"
                  : "border-gray-200 hover:border-indigo-300"
              }`}
              data-testid={`archive-run-card-${run.id}`}
            >
              {/* Disputed Warning Banner */}
              {run.isDisputed && (
                <div
                  className="bg-rose-50 border-b border-rose-200 p-3 px-5 flex items-start gap-3"
                  data-testid={`disputed-warning-banner-${run.id}`}
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-800 uppercase tracking-wider bg-rose-200/60 px-2 py-0.5 rounded">
                        Disputed — Not Safe to Archive
                      </span>
                    </div>
                    <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                      {run.disputeReason ||
                        "This payroll run has an unresolved dispute and is visibly NOT safe to archive until compliance review is completed."}
                    </p>
                  </div>
                </div>
              )}

              {/* Main Card Content */}
              <div className="p-5 space-y-4">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md">
                      {run.payrollRunId}
                    </span>
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-gray-500" />
                      {run.employerName}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      Period: {run.payPeriod}
                    </span>
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      Asset: {run.asset}
                    </span>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase ${getStatusBadgeClass(
                        run.status
                      )}`}
                    >
                      {run.status}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${getAuditBadgeClass(
                        run.auditAvailability
                      )}`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      Audit {run.auditAvailability}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                  {/* Total Disbursement Amount (Privacy Masked) */}
                  <div className="bg-gray-50/70 p-3 rounded-lg border border-gray-100 space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-500" />
                      Total Disbursement
                    </span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-bold text-gray-900 font-mono">
                        {hidePrivateData
                          ? "••••••••"
                          : `$${run.totalAmount.toLocaleString()}`}
                      </span>
                      {hidePrivateData && (
                        <span className="text-[9px] text-gray-400 font-semibold uppercase">
                          Redacted
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500">
                      {run.employeeCount} Recipients
                    </p>
                  </div>

                  {/* Execution Timestamp */}
                  <div className="bg-gray-50/70 p-3 rounded-lg border border-gray-100 space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-500" />
                      Execution Date
                    </span>
                    <p className="text-xs font-semibold text-gray-800">
                      {new Date(run.executedAt).toLocaleString()}
                    </p>
                    {run.archivedAt && (
                      <p className="text-[10px] text-slate-500">
                        Archived: {new Date(run.archivedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Transaction Hash */}
                  <div className="bg-gray-50/70 p-3 rounded-lg border border-gray-100 space-y-1 sm:col-span-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Stellar Transaction Hash</span>
                      {copiedTxHash === run.transactionHash && (
                        <span className="text-emerald-600 font-semibold">Copied!</span>
                      )}
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-gray-800 truncate">
                        {run.transactionHash}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyTxHash(run.transactionHash)}
                        className="text-gray-400 hover:text-indigo-600 p-1 shrink-0"
                        title="Copy transaction hash"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer Action Links */}
                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Links to Audit Packet & Receipt Views */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {run.bundleId ? (
                      <Link
                        href={`/compliance?bundleId=${run.bundleId}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
                        data-testid={`view-audit-packet-${run.id}`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        View Audit Packet ({run.bundleId})
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 italic flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        No Audit Packet linked
                      </span>
                    )}

                    {run.receiptId ? (
                      <Link
                        href={`/compliance?tab=receipts&runId=${run.payrollRunId}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                        data-testid={`view-receipt-${run.id}`}
                      >
                        <Receipt className="w-3.5 h-3.5 text-slate-500" />
                        View Receipt ({run.receiptId})
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 italic flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5 text-gray-300" />
                        No Receipt linked
                      </span>
                    )}
                  </div>

                  {/* Archive / Unarchive Action */}
                  <div className="flex items-center gap-2">
                    {run.isDisputed ? (
                      <button
                        type="button"
                        disabled
                        onClick={() => handleArchiveToggle(run)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg cursor-not-allowed"
                        data-testid={`archive-button-disabled-${run.id}`}
                        title="Disputed runs are not safe to archive"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        Not Safe to Archive
                      </button>
                    ) : (
                      <Button
                        onClick={() => handleArchiveToggle(run)}
                        variant={run.isArchived ? "outline" : "default"}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                          run.isArchived
                            ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                        data-testid={`archive-button-${run.id}`}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        {run.isArchived ? "Unarchive Run" : "Archive Run"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
