"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Clock,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Trash2,
  ArrowUpDown,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { usePayrollDraftsStore } from "@/stores/payrollDrafts";
import type { PayrollDraft, DraftStatus } from "@/stores/payrollDrafts";

const STATUS_CONFIG: Record<DraftStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: <FileText className="w-3.5 h-3.5" /> },
  recovering: { label: "Recovering", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" /> },
  recovered: { label: "Recovered", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  expired: { label: "Expired", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: <Clock className="w-3.5 h-3.5" /> },
  discarded: { label: "Discarded", color: "text-gray-500", bg: "bg-gray-50 border-gray-200", icon: <Trash2 className="w-3.5 h-3.5" /> },
};

function DraftRow({ draft, onRecover, onDiscard, onDelete }: {
  draft: PayrollDraft;
  onRecover: () => void;
  onDiscard: () => void;
  onDelete: () => void;
}) {
  const config = STATUS_CONFIG[draft.status];
  const isExpired = new Date(draft.expiresAt) < new Date();
  const hoursLeft = Math.max(0, Math.round((new Date(draft.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));

  return (
    <div className={`border rounded-lg p-4 transition-colors ${isExpired ? "opacity-60" : "hover:bg-muted/50"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{draft.name}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color} ${config.bg}`}>
              {config.icon}
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{draft.payPeriod}</span>
            <span>{draft.currency}</span>
            <span>{draft.employeeIds.length} employees</span>
            <span className="font-medium">${draft.totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>Created: {new Date(draft.createdAt).toLocaleDateString()}</span>
            <span>Updated: {new Date(draft.updatedAt).toLocaleDateString()}</span>
            {!isExpired && draft.status === "draft" && (
              <span className="flex items-center gap-1 text-yellow-600">
                <Clock className="w-3 h-3" />
                {hoursLeft}h remaining
              </span>
            )}
            {isExpired && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="w-3 h-3" />
                Expired
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {draft.status === "draft" && !isExpired && (
            <button
              onClick={onRecover}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recover
            </button>
          )}
          {draft.status === "recovering" && (
            <span className="text-sm text-yellow-600 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Recovering...
            </span>
          )}
          {draft.status === "draft" && (
            <button
              onClick={onDiscard}
              className="p-1.5 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-red-50"
              title="Discard draft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {(draft.status === "expired" || draft.status === "discarded") && (
            <button
              onClick={onDelete}
              className="p-1.5 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-red-50"
              title="Delete permanently"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PayrollDraftRecovery() {
  const {
    drafts,
    filterStatus,
    searchQuery,
    sortField,
    sortDirection,
    setFilterStatus,
    setSearchQuery,
    setSortField,
    toggleSortDirection,
    recoverDraft,
    discardDraft,
    removeDraft,
    cleanupExpired,
    getFilteredDrafts,
    addDraft,
  } = usePayrollDraftsStore();

  const filteredDrafts = getFilteredDrafts();
  const draftCount = drafts.filter((d) => d.status === "draft").length;
  const expiredCount = drafts.filter((d) => d.status === "expired").length;

  useEffect(() => {
    cleanupExpired();
  }, [cleanupExpired]);

  useEffect(() => {
    if (drafts.length === 0) {
      const now = new Date().toISOString();
      const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const expiredDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

      addDraft({
        name: "August Payroll - Engineering",
        employeeIds: ["emp_1", "emp_2", "emp_3", "emp_4", "emp_5"],
        totalAmount: 75000,
        payPeriod: "Aug 2025",
        currency: "USDC",
        lastSavedBy: "admin@zkpayroll.io",
      });
      addDraft({
        name: "Contractor Payment - Q3",
        employeeIds: ["emp_6", "emp_7"],
        totalAmount: 25000,
        payPeriod: "Q3 2025",
        currency: "XLM",
        lastSavedBy: "finance@zkpayroll.io",
      });
    }
  }, [drafts.length, addDraft]);

  const handleRecover = (id: string) => {
    recoverDraft(id);
    setTimeout(() => {
      usePayrollDraftsStore.getState().updateDraft(id, {
        status: "recovered",
      });
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll Drafts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recover and manage unfinished payroll drafts
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-blue-600">
            <FileText className="w-4 h-4" />
            {draftCount} active
          </span>
          {expiredCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              {expiredCount} expired
            </span>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800">Draft auto-expiration</p>
          <p className="text-amber-700 mt-0.5">
            Unfinished drafts expire after 72 hours. Recover a draft before it expires to continue where you left off.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search drafts by name, period, or currency..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="pl-10 pr-8 py-2 border rounded-lg text-sm appearance-none bg-white"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="recovering">Recovering</option>
              <option value="recovered">Recovered</option>
              <option value="expired">Expired</option>
              <option value="discarded">Discarded</option>
            </select>
          </div>
          <button
            onClick={() => { sortField === "updatedAt" ? toggleSortDirection() : setSortField("updatedAt"); }}
            className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-muted"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="hidden sm:inline">Sort</span>
          </button>
        </div>
      </div>

      {/* Draft List */}
      <div className="space-y-2">
        {filteredDrafts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No drafts found</p>
            <p className="text-sm">Start a payroll run and save as draft to see it here</p>
          </div>
        ) : (
          filteredDrafts.map((draft) => (
            <DraftRow
              key={draft.id}
              draft={draft}
              onRecover={() => handleRecover(draft.id)}
              onDiscard={() => discardDraft(draft.id)}
              onDelete={() => removeDraft(draft.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
