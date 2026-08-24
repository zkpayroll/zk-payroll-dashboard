"use client";

import { useMemo, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  FileText,
  Hash,
  Lock,
} from "lucide-react";
import type {
  AuditTimelineEvent,
  AuditReadyTimeline,
  AuditTimelineEventType,
} from "@/types/models";

interface AuditReadyTimelineProps {
  payrollId?: string;
  timeline?: AuditReadyTimeline;
  className?: string;
}

const EVENT_LABELS: Record<AuditTimelineEventType, string> = {
  run_initiated: "Payroll Run Initiated",
  employees_selected: "Employees Selected",
  proof_generated: "ZK Proof Generated",
  treasury_verified: "Treasury Verified",
  approval_received: "Approval Received",
  transaction_submitted: "Transaction Submitted",
  block_confirmed: "Block Confirmed",
  reconciliation_completed: "Reconciliation Completed",
  run_failed: "Run Failed",
};

const EVENT_ICONS: Record<AuditTimelineEventType, typeof CheckCircle2> = {
  run_initiated: Clock,
  employees_selected: CheckCircle2,
  proof_generated: Lock,
  treasury_verified: CheckCircle2,
  approval_received: CheckCircle2,
  transaction_submitted: CheckCircle2,
  block_confirmed: CheckCircle2,
  reconciliation_completed: CheckCircle2,
  run_failed: Clock,
};

function generateMockTimeline(payrollId: string): AuditReadyTimeline {
  const now = new Date();
  const events: AuditTimelineEvent[] = [
    {
      id: "evt_001",
      type: "run_initiated",
      timestamp: new Date(now.getTime() - 3600000).toISOString(),
      actor: "admin_001",
      summary: "Payroll run initiated for 5 employees",
      eventHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    },
    {
      id: "evt_002",
      type: "employees_selected",
      timestamp: new Date(now.getTime() - 3500000).toISOString(),
      actor: "admin_001",
      summary: "5 employees selected, 2 assets configured",
      eventHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      metadata: {
        employeeCommitment: "0x" + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        assetCount: "2",
      },
    },
    {
      id: "evt_003",
      type: "proof_generated",
      timestamp: new Date(now.getTime() - 3000000).toISOString(),
      actor: "system",
      summary: "ZK-SNARK proof generated and verified on-chain",
      eventHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      metadata: {
        circuitHash: "0x" + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        proofHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      },
    },
    {
      id: "evt_004",
      type: "treasury_verified",
      timestamp: new Date(now.getTime() - 2500000).toISOString(),
      actor: "system",
      summary: "Treasury balance verified: sufficient funds confirmed",
      eventHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      metadata: {
        balanceCommitment: "0x" + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      },
    },
    {
      id: "evt_005",
      type: "approval_received",
      timestamp: new Date(now.getTime() - 2000000).toISOString(),
      actor: "admin_001",
      summary: "Executive approval received and recorded on-chain",
      eventHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      metadata: {
        approvalSignature: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      },
    },
    {
      id: "evt_006",
      type: "transaction_submitted",
      timestamp: new Date(now.getTime() - 1500000).toISOString(),
      actor: "system",
      summary: "Payroll transaction submitted to Stellar network",
      eventHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      metadata: {
        txHashCommitment: "0x" + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      },
    },
    {
      id: "evt_007",
      type: "block_confirmed",
      timestamp: new Date(now.getTime() - 1000000).toISOString(),
      actor: "system",
      summary: "Transaction confirmed in ledger 12345678",
      eventHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      metadata: {
        ledgerSequence: "12345678",
        closeTime: new Date(now.getTime() - 1000000).toISOString(),
      },
    },
    {
      id: "evt_008",
      type: "reconciliation_completed",
      timestamp: new Date(now.getTime() - 500000).toISOString(),
      actor: "admin_001",
      summary: "Reconciliation complete: 5/5 employees confirmed",
      eventHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      metadata: {
        confirmedCount: "5",
        totalEmployees: "5",
      },
    },
  ];

  // Calculate merkle root (simplified)
  const allHashes = events.map((e) => e.eventHash).join("");
  const timelineRoot =
    "0x" +
    Array.from({ length: 64 }, (_, i) =>
      allHashes.charCodeAt(i % allHashes.length).toString(16),
    ).join("");

  return {
    payrollId,
    companyId: "company_001",
    events,
    timelineRoot,
    generatedAt: new Date().toISOString(),
    exported: false,
  };
}

export function AuditReadyTimeline({
  payrollId = "payroll_001",
  timeline: providedTimeline,
  className = "",
}: AuditReadyTimelineProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const timeline = useMemo(
    () => providedTimeline ?? generateMockTimeline(payrollId),
    [payrollId, providedTimeline],
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
            <span>Auditor-Ready Payroll Timeline</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-gray-100 px-2.5 py-1 text-sm font-mono font-semibold text-gray-800">
              {timeline.payrollId}
            </code>
            <span className="text-xs text-gray-500">
              {timeline.events.length} events
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-gray-500">
            <div>
              Generated:{" "}
              <span className="font-semibold text-gray-700">
                {new Date(timeline.generatedAt).toLocaleString()}
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600">
            <FileText className="h-3.5 w-3.5" />
            Privacy-Safe
          </span>
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="mt-4 flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        <div className="text-xs text-indigo-700">
          <p className="font-semibold">Privacy-Safe View</p>
          <p className="mt-0.5">
            This timeline excludes private salary amounts and uses cryptographic
            commitments to prove process integrity without exposing sensitive data.
          </p>
        </div>
      </div>

      {/* Merkle Root */}
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 p-3">
        <Hash className="h-4 w-4 text-gray-400" />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-500">Timeline Merkle Root</span>
          <div className="flex items-center gap-2">
            <code className="truncate text-xs font-mono text-gray-700">
              {timeline.timelineRoot}
            </code>
            <button
              onClick={() => handleCopy(timeline.timelineRoot, "root")}
              className="shrink-0 p-1 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
              title="Copy Merkle Root"
            >
              {copied === "root" ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Events */}
      <div className="mt-6 relative space-y-6 before:absolute before:left-5 before:top-3 before:h-[calc(100%-24px)] before:w-0.5 before:bg-gray-200">
        {timeline.events.map((event, idx) => {
          const EventIcon = EVENT_ICONS[event.type];
          const isLast = idx === timeline.events.length - 1;

          return (
            <div key={event.id} className="relative flex items-start gap-4">
              {/* Node Icon */}
              <div
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  event.type === "run_failed"
                    ? "bg-red-100"
                    : "bg-indigo-100"
                }`}
              >
                <EventIcon
                  className={`h-5 w-5 ${
                    event.type === "run_failed"
                      ? "text-red-600"
                      : "text-indigo-600"
                  }`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 rounded-lg border border-gray-100 bg-gray-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {EVENT_LABELS[event.type]}
                    </span>
                    {event.actor === "system" && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        System
                      </span>
                    )}
                  </div>
                  <time className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </time>
                </div>

                <p className="mt-1 text-sm text-gray-700">{event.summary}</p>

                {/* Event Hash */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Event Hash:</span>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
                    {event.eventHash.slice(0, 16)}...
                  </code>
                  <button
                    onClick={() => handleCopy(event.eventHash, event.id)}
                    className="p-0.5 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                    title="Copy Event Hash"
                  >
                    {copied === event.id ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>

                {/* Metadata */}
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(event.metadata).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                      >
                        <span className="font-medium">{key}:</span>
                        <span className="font-mono text-gray-500">
                          {typeof value === "string" && value.length > 20
                            ? `${value.slice(0, 12)}...`
                            : String(value)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-500">
          All event hashes are cryptographically bound. Verify integrity by
          recomputing the Merkle root.
        </p>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          Export for Audit
        </button>
      </div>
    </div>
  );
}

export default AuditReadyTimeline;
