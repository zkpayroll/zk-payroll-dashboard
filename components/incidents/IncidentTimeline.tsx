"use client";

import React, { useMemo, useState } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  generateIncidentTimeline,
  sanitizeErrorMessage,
  type IncidentTimeline as TimelineData,
  type IncidentTimelineEntry,
  type PayrollStage,
} from "@/src/observability";

export interface IncidentTimelineProps {
  correlationId?: string;
  timeline?: TimelineData;
  className?: string;
}

const STAGE_NAMES: Record<PayrollStage, string> = {
  draft: "Draft Creation",
  validation: "Validation",
  proof_setup: "ZK Proof Setup",
  wallet_signing: "Wallet Signing",
  tx_submission: "Tx Submission",
  polling: "Blockchain Polling",
  failure: "Run Failure",
  retry: "Transaction Retry",
  reconciliation: "Reconciliation",
  employer_onboarding: "Employer Onboarding",
};

export function IncidentTimeline({
  correlationId,
  timeline: providedTimeline,
  className = "",
}: IncidentTimelineProps) {
  const [copied, setCopied] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});

  const timeline = useMemo(() => {
    if (providedTimeline) return providedTimeline;
    if (correlationId) return generateIncidentTimeline(correlationId);
    return null;
  }, [correlationId, providedTimeline]);

  if (!timeline) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-800 dark:bg-gray-900 ${className}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">No correlation ID or timeline provided.</p>
      </div>
    );
  }

  const handleCopyId = () => {
    if (timeline.correlationId) {
      navigator.clipboard.writeText(timeline.correlationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleExpand = (entryId: string) => {
    setExpandedEntries((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  };

  const getStatusBadge = (status: TimelineData["runStatus"]) => {
    switch (status) {
      case "succeeded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Succeeded
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5" /> Failed
          </span>
        );
      case "partial":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <AlertOctagon className="h-3.5 w-3.5" /> Partial Failure
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <Clock className="h-3.5 w-3.5" /> In Progress
          </span>
        );
    }
  };

  const getEntryIcon = (entry: IncidentTimelineEntry) => {
    if (entry.status === "failed") {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (entry.status === "retried") {
      return <RefreshCw className="h-5 w-5 text-amber-500" />;
    }
    if (entry.status === "succeeded") {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    }
    return <Clock className="h-5 w-5 text-blue-500" />;
  };

  return (
    <div className={`space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Incident Replay Timeline</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-gray-100 px-2.5 py-1 text-sm font-mono font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {timeline.correlationId}
            </code>
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="Copy Correlation ID"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right text-xs text-gray-500 dark:text-gray-400">
            <div>Duration: <span className="font-semibold text-gray-700 dark:text-gray-300">{timeline.totalDurationMs} ms</span></div>
            <div>Events: <span className="font-semibold text-gray-700 dark:text-gray-300">{timeline.eventCount}</span></div>
          </div>
          {getStatusBadge(timeline.runStatus)}
        </div>
      </div>

      {/* Failure Alert Banner if run failed */}
      {timeline.hasFailures && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/80 p-4 dark:border-red-900/50 dark:bg-red-950/40">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-sm">
            <p className="font-semibold text-red-900 dark:text-red-200">
              Payroll Run Failed or Encountered Errors
            </p>
            <p className="mt-0.5 text-red-700 dark:text-red-300">
              Review the stage progression below to inspect redacted failure categories and diagnostic context.
            </p>
          </div>
        </div>
      )}

      {/* Timeline Entries */}
      {timeline.entries.length === 0 ? (
        <p className="text-center text-sm text-gray-500">No events recorded for this correlation ID.</p>
      ) : (
        <div className="relative space-y-6 before:absolute before:left-6 before:top-3 before:h-[calc(100%-24px)] before:w-0.5 before:bg-gray-200 dark:before:bg-gray-800">
          {timeline.entries.map((entry) => {
            const isExpanded = expandedEntries[entry.id] ?? false;
            const stageLabel = STAGE_NAMES[entry.stage] || entry.stage;

            return (
              <div key={entry.id} className="relative flex items-start gap-4">
                {/* Node Icon */}
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white ring-4 ring-white dark:bg-gray-950 dark:ring-gray-950">
                  {getEntryIcon(entry)}
                </div>

                {/* Content Box */}
                <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50/50 p-4 transition-all hover:border-gray-200 dark:border-gray-800/60 dark:bg-gray-900/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">#{entry.sequence}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{stageLabel}</span>
                      <span className="rounded bg-gray-200/60 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {entry.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {entry.durationMs !== undefined && (
                        <span className="font-mono">{entry.durationMs} ms</span>
                      )}
                      <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
                    </div>
                  </div>

                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    {entry.formattedSummary}
                  </p>

                  {/* Error Details */}
                  {entry.status === "failed" && (
                    <div className="mt-3 rounded-md bg-red-100/60 p-3 text-xs text-red-900 dark:bg-red-950/60 dark:text-red-200">
                      <div className="font-semibold">Error Category: {entry.errorCategory || "unknown"}</div>
                      {entry.errorLabel && <div>Label: {entry.errorLabel}</div>}
                      {entry.errorMessage && <div className="mt-1 font-mono">{sanitizeErrorMessage(entry.errorMessage)}</div>}
                    </div>
                  )}

                  {/* Redacted Context Accordion */}
                  <div className="mt-3">
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <span>{isExpanded ? "Hide Redacted Context" : "View Redacted Context"}</span>
                    </button>

                    {isExpanded && (
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-900 p-3 font-mono text-xs text-emerald-400 dark:bg-black">
                        {JSON.stringify(entry.redactedContext, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default IncidentTimeline;
