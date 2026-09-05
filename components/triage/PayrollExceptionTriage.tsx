"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Filter,
  Search,
  ArrowRight,
  Shield,
  Lock,
  RefreshCw,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  PayrollTriageException,
  ExceptionSeverity,
  ExceptionSource,
  ExceptionStatus,
} from "@/types/models";
import { MOCK_PAYROLL_EXCEPTIONS } from "@/lib/exceptions/triageData";

export interface PayrollExceptionTriageProps {
  initialExceptions?: PayrollTriageException[];
  onActionClick?: (exception: PayrollTriageException, action: string) => void;
}

const SEVERITY_ICONS = {
  blocking: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_BADGES = {
  blocking: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

const SEVERITY_CARD_STYLES = {
  blocking: "border-l-4 border-l-red-500 border-gray-200 bg-red-50/20",
  warning: "border-l-4 border-l-amber-500 border-gray-200 bg-amber-50/20",
  info: "border-l-4 border-l-blue-500 border-gray-200 bg-blue-50/20",
};

const STATUS_BADGES = {
  open: "bg-rose-50 text-rose-700 border-rose-200",
  investigating: "bg-purple-50 text-purple-700 border-purple-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  dismissed: "bg-gray-100 text-gray-700 border-gray-200",
};

const SOURCE_LABELS: Record<ExceptionSource, string> = {
  circuit_verifier: "ZK Circuit Verifier",
  wallet_router: "Wallet Router",
  compliance_check: "Compliance Engine",
  treasury_guard: "Treasury Guard",
  batch_parser: "Batch Parser",
  oracle_bridge: "Oracle / Horizon Bridge",
};

export default function PayrollExceptionTriage({
  initialExceptions = MOCK_PAYROLL_EXCEPTIONS,
  onActionClick,
}: PayrollExceptionTriageProps) {
  const [exceptions, setExceptions] = useState<PayrollTriageException[]>(initialExceptions);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<ExceptionSeverity | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<ExceptionSource | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ExceptionStatus | "all">("all");
  const [groupBy, setGroupBy] = useState<"none" | "severity" | "source" | "status">("none");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Summary counts
  const counts = useMemo(() => {
    return {
      total: exceptions.length,
      blocking: exceptions.filter((e) => e.severity === "blocking" && e.status !== "resolved").length,
      warning: exceptions.filter((e) => e.severity === "warning" && e.status !== "resolved").length,
      info: exceptions.filter((e) => e.severity === "info" && e.status !== "resolved").length,
      resolved: exceptions.filter((e) => e.status === "resolved").length,
    };
  }, [exceptions]);

  // Filtering
  const filteredExceptions = useMemo(() => {
    return exceptions.filter((item) => {
      if (severityFilter !== "all" && item.severity !== severityFilter) return false;
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesRun = item.runId.toLowerCase().includes(q);
        const matchesSource = item.source.toLowerCase().includes(q);
        const matchesAction = item.suggestedAction.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesRun && !matchesSource && !matchesAction) {
          return false;
        }
      }
      return true;
    });
  }, [exceptions, severityFilter, sourceFilter, statusFilter, searchQuery]);

  // Grouping
  const groupedExceptions = useMemo(() => {
    if (groupBy === "none") {
      return [{ groupName: "All Exceptions", items: filteredExceptions }];
    }

    const map = new Map<string, PayrollTriageException[]>();

    filteredExceptions.forEach((item) => {
      let key = "Other";
      if (groupBy === "severity") {
        key = item.severity.toUpperCase();
      } else if (groupBy === "source") {
        key = SOURCE_LABELS[item.source] || item.source;
      } else if (groupBy === "status") {
        key = item.status.toUpperCase();
      }

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });

    return Array.from(map.entries()).map(([groupName, items]) => ({
      groupName,
      items,
    }));
  }, [filteredExceptions, groupBy]);

  const updateStatus = (id: string, newStatus: ExceptionStatus) => {
    setExceptions((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          return {
            ...e,
            status: newStatus,
            resolvedAt: newStatus === "resolved" ? new Date().toISOString() : null,
          };
        }
        return e;
      })
    );
  };

  return (
    <section aria-labelledby="triage-dashboard-heading" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 id="triage-dashboard-heading" className="text-2xl font-bold text-gray-900">
            Payroll Exception Triage
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review, classify, and triage blocking errors, warnings, and compliance alerts across payroll runs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/payroll"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Payroll Wizard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Summary Scorecards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setSeverityFilter("all");
            setStatusFilter("all");
          }}
          className={`p-4 rounded-lg border text-left transition-all ${
            severityFilter === "all" && statusFilter === "all"
              ? "border-indigo-600 ring-2 ring-indigo-100 bg-white"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <span className="text-xs font-medium text-gray-500">Total Exceptions</span>
          <p className="mt-1 text-2xl font-bold text-gray-900">{counts.total}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setSeverityFilter("blocking");
            setStatusFilter("all");
          }}
          className={`p-4 rounded-lg border text-left transition-all ${
            severityFilter === "blocking"
              ? "border-red-600 ring-2 ring-red-100 bg-red-50/50"
              : "border-red-200 bg-red-50/30 hover:border-red-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-700">Blocking Errors</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <p className="mt-1 text-2xl font-bold text-red-900">{counts.blocking}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setSeverityFilter("warning");
            setStatusFilter("all");
          }}
          className={`p-4 rounded-lg border text-left transition-all ${
            severityFilter === "warning"
              ? "border-amber-600 ring-2 ring-amber-100 bg-amber-50/50"
              : "border-amber-200 bg-amber-50/30 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Warnings</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-900">{counts.warning}</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("resolved");
            setSeverityFilter("all");
          }}
          className={`p-4 rounded-lg border text-left transition-all ${
            statusFilter === "resolved"
              ? "border-emerald-600 ring-2 ring-emerald-100 bg-emerald-50/50"
              : "border-emerald-200 bg-emerald-50/30 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{counts.resolved}</p>
        </button>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search exceptions by title, run ID, or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Search exceptions"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <label htmlFor="severity-select" className="sr-only">Severity</label>
              <select
                id="severity-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Severities</option>
                <option value="blocking">Blocking Only</option>
                <option value="warning">Warnings Only</option>
                <option value="info">Info Only</option>
              </select>
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <label htmlFor="source-select" className="sr-only">Source</label>
              <select
                id="source-select"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Sources</option>
                <option value="circuit_verifier">ZK Circuit Verifier</option>
                <option value="treasury_guard">Treasury Guard</option>
                <option value="wallet_router">Wallet Router</option>
                <option value="compliance_check">Compliance Check</option>
                <option value="oracle_bridge">Oracle / Horizon Bridge</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <label htmlFor="status-select" className="sr-only">Status</label>
              <select
                id="status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>

            {/* Grouping */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <label htmlFor="group-select" className="sr-only">Group By</label>
              <select
                id="group-select"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="none">No Grouping</option>
                <option value="severity">Group by Severity</option>
                <option value="source">Group by Source</option>
                <option value="status">Group by Status</option>
              </select>
            </div>

            {(severityFilter !== "all" || sourceFilter !== "all" || statusFilter !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter("all");
                  setSourceFilter("all");
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-900 underline"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Exception List / Groups */}
      {filteredExceptions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-lg border border-gray-200 shadow-sm space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-base font-semibold text-gray-900">No payroll exceptions found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            All payroll operations match your criteria or no active issues require triage.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedExceptions.map(({ groupName, items }) => (
            <div key={groupName} className="space-y-3">
              {groupBy !== "none" && (
                <div className="flex items-center justify-between border-b pb-2">
                  <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                    {groupName} ({items.length})
                  </h2>
                </div>
              )}

              <ul className="space-y-3" aria-label={`triage list ${groupName}`}>
                {items.map((exc) => {
                  const SeverityIcon = SEVERITY_ICONS[exc.severity] || AlertCircle;
                  const severityBadge = SEVERITY_BADGES[exc.severity] || "bg-gray-100 text-gray-700";
                  const statusBadge = STATUS_BADGES[exc.status] || "bg-gray-100 text-gray-700";
                  const cardStyle = SEVERITY_CARD_STYLES[exc.severity] || "border-gray-200 bg-white";
                  const isExpanded = expandedId === exc.id;

                  return (
                    <li
                      key={exc.id}
                      className={`rounded-lg border p-5 shadow-sm transition-all bg-white ${cardStyle}`}
                      data-testid={`exception-${exc.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        {/* Title & Severity */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <SeverityIcon
                            className={`w-5 h-5 shrink-0 mt-0.5 ${
                              exc.severity === "blocking"
                                ? "text-red-600"
                                : exc.severity === "warning"
                                ? "text-amber-600"
                                : "text-blue-600"
                            }`}
                            aria-hidden="true"
                          />
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-gray-900">
                                {exc.title}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-xs font-bold uppercase rounded-full border ${severityBadge}`}
                              >
                                {exc.severity}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-xs font-semibold uppercase rounded-full border ${statusBadge}`}
                              >
                                {exc.status}
                              </span>
                            </div>

                            <p className="text-sm text-gray-600">{exc.description}</p>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
                              <span>Run: <strong className="text-gray-700">{exc.runId}</strong></span>
                              <span>Source: <strong className="text-gray-700">{SOURCE_LABELS[exc.source]}</strong></span>
                              <span>Category: <strong className="text-gray-700">{exc.category}</strong></span>
                              <span>Reported: {new Date(exc.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Actions */}
                        <div className="flex items-center gap-2 self-start shrink-0">
                          {exc.status !== "investigating" && exc.status !== "resolved" && (
                            <button
                              type="button"
                              onClick={() => updateStatus(exc.id, "investigating")}
                              className="px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                            >
                              Investigate
                            </button>
                          )}
                          {exc.status !== "resolved" && (
                            <button
                              type="button"
                              onClick={() => updateStatus(exc.id, "resolved")}
                              className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                          {exc.status === "resolved" && (
                            <button
                              type="button"
                              onClick={() => updateStatus(exc.id, "open")}
                              className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                            >
                              Re-open
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Required Next Action */}
                      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start sm:items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 shrink-0 uppercase tracking-wide">
                            Required Action:
                          </span>
                          <span className="text-xs text-slate-700 font-medium">
                            {exc.suggestedAction}
                          </span>
                        </div>
                        {exc.nextStepUrl && (
                          <Link
                            href={exc.nextStepUrl}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
                          >
                            Resolve in wizard
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>

                      {/* Confidentiality / Redacted Details Toggle */}
                      {(exc.affectedEmployees?.length || exc.redactedProofDigest) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : exc.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
                            aria-expanded={isExpanded}
                          >
                            <Lock className="w-3.5 h-3.5 text-gray-500" />
                            <span>
                              {isExpanded ? "Hide redacted context" : "View privacy & recipient details"}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200 text-xs space-y-2">
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Shield className="w-4 h-4 text-emerald-600" />
                                <span className="font-semibold text-gray-800">
                                  Privacy Redaction Active:
                                </span>
                                <span className="text-gray-500">
                                  Raw payroll amounts and secret keys are hidden to protect privacy.
                                </span>
                              </div>

                              {exc.redactedProofDigest && (
                                <div className="font-mono text-gray-600 bg-white p-2 rounded border border-gray-200">
                                  Proof Digest: {exc.redactedProofDigest}
                                </div>
                              )}

                              {exc.affectedEmployees && exc.affectedEmployees.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <span className="font-semibold text-gray-700">
                                    Affected Employees ({exc.affectedEmployees.length}):
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {exc.affectedEmployees.map((emp) => (
                                      <div
                                        key={emp.id}
                                        className="p-2 bg-white rounded border border-gray-200 flex flex-col gap-0.5"
                                      >
                                        <span className="font-medium text-gray-900">
                                          {emp.name} ({emp.id})
                                        </span>
                                        <span className="text-gray-500 text-[11px]">
                                          {emp.department || "General"} · {emp.salaryCommitmentHash}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
