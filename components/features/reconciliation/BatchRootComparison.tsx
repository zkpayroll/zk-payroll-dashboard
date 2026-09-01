"use client";

import { useState, useCallback, useMemo } from "react";
import { CheckCircle2, XCircle, Clock, AlertCircle, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { computeBatchRootStatus, getMismatchReason, type BatchRootMatchStatus } from "@/stores/reconciliation";

interface BatchRootComparisonProps {
  expectedRoot?: string | null;
  observedRoot?: string | null;
  eventSource?: string | null;
  eventReference?: string | null;
}

const STATUS_CONFIG: Record<BatchRootMatchStatus, { label: string; variant: "success" | "warning" | "destructive" | "default"; icon: React.ComponentType<{ className?: string }> }> = {
  match: { label: "Match", variant: "success", icon: CheckCircle2 },
  mismatch: { label: "Mismatch", variant: "destructive", icon: XCircle },
  pending: { label: "Pending", variant: "warning", icon: Clock },
  missing: { label: "Missing", variant: "default", icon: AlertCircle },
};

function CopyButton({ value, label, copied, onCopy }: { value: string; label: string; copied: boolean; onCopy: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onCopy}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      disabled={!value}
      className="gap-1.5"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-600" aria-hidden="true" />
          <span className="text-xs font-medium text-green-600">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="text-xs font-medium">Copy</span>
        </>
      )}
    </Button>
  );
}

function RootDisplay({ label, value, copied, onCopy }: { label: string; value: string | null; copied: boolean; onCopy: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">{label}</span>
        {value && <CopyButton value={value} label={label} copied={copied} onCopy={onCopy} />}
      </div>
      <div className="font-mono text-xs text-gray-900 bg-gray-50 p-3 rounded-md break-all border border-gray-200 min-h-[2.5rem]">
        {value ?? <span className="text-gray-400 italic">Not available</span>}
      </div>
    </div>
  );
}

export default function BatchRootComparison({
  expectedRoot: propExpectedRoot,
  observedRoot: propObservedRoot,
  eventSource: propEventSource,
  eventReference: propEventReference,
}: BatchRootComparisonProps) {
  const expectedRoot = propExpectedRoot ?? null;
  const observedRoot = propObservedRoot ?? null;
  const eventSource = propEventSource ?? null;
  const eventReference = propEventReference ?? null;

  const status = useMemo(() => computeBatchRootStatus(expectedRoot, observedRoot), [expectedRoot, observedRoot]);
  const mismatchReason = useMemo(() => getMismatchReason(expectedRoot, observedRoot), [expectedRoot, observedRoot]);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const [copiedExpected, setCopiedExpected] = useState(false);
  const [copiedObserved, setCopiedObserved] = useState(false);

  const handleCopyExpected = useCallback(async () => {
    if (!expectedRoot) return;
    try {
      await navigator.clipboard.writeText(expectedRoot);
      setCopiedExpected(true);
      toast.success("Expected root copied");
      setTimeout(() => setCopiedExpected(false), 2000);
    } catch {
      toast.error("Could not copy expected root");
    }
  }, [expectedRoot]);

  const handleCopyObserved = useCallback(async () => {
    if (!observedRoot) return;
    try {
      await navigator.clipboard.writeText(observedRoot);
      setCopiedObserved(true);
      toast.success("Observed root copied");
      setTimeout(() => setCopiedObserved(false), 2000);
    } catch {
      toast.error("Could not copy observed root");
    }
  }, [observedRoot]);

  const explorerUrl = eventReference
    ? `https://stellar.expert/explorer/testnet/tx/${eventReference}`
    : null;

  return (
    <section
      aria-labelledby="batch-root-comparison-heading"
      className="bg-white rounded-lg shadow-sm overflow-hidden"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b bg-gray-50">
        <h2 id="batch-root-comparison-heading" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" aria-hidden="true" />
          Batch Root Comparison
        </h2>
        <Badge
          role="status"
          aria-label={`Status: ${config.label}`}
          variant={config.variant}
          className="flex items-center gap-1.5 px-2.5 py-0.5"
        >
          <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {config.label}
        </Badge>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RootDisplay
            label="Expected Root"
            value={expectedRoot}
            copied={copiedExpected}
            onCopy={handleCopyExpected}
          />
          <RootDisplay
            label="Observed Root"
            value={observedRoot}
            copied={copiedObserved}
            onCopy={handleCopyObserved}
          />
        </div>

        {eventSource && (
          <div className="space-y-2 pt-4 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Event Source</span>
            <p className="text-sm text-gray-900 font-medium">{eventSource}</p>
          </div>
        )}

        {eventReference && (
          <div className="space-y-2 pt-4 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Event Reference</span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs text-gray-900 bg-gray-50 px-3 py-2 rounded-md break-all border border-gray-200">
                {eventReference}
              </span>
              <CopyButton
                value={eventReference}
                label="event reference"
                copied={false}
                onCopy={async () => {
                  try {
                    await navigator.clipboard.writeText(eventReference!);
                    toast.success("Event reference copied");
                  } catch {
                    toast.error("Could not copy event reference");
                  }
                }}
              />
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View transaction on Stellar Expert explorer (opens in a new tab)"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                >
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  View on Explorer
                </a>
              )}
            </div>
          </div>
        )}

        {status === "mismatch" && mismatchReason && (
          <div
            role="alert"
            aria-label="Reconciliation mismatch reason"
            className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3"
          >
            <XCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h4 className="text-sm font-semibold text-amber-800">Mismatch Detected</h4>
              <p className="text-sm text-amber-700 mt-1">{mismatchReason}</p>
              <p className="text-xs text-amber-600 mt-2">
                Individual salary data is never exposed. This comparison operates only on batch-level commitment hashes.
              </p>
            </div>
          </div>
        )}

        {status === "pending" && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h4 className="text-sm font-semibold text-blue-800">Reconciliation Pending</h4>
              <p className="text-sm text-blue-700 mt-1">
                {expectedRoot && !observedRoot
                  ? "Expected root is recorded. Waiting for on-chain event to provide observed root."
                  : !expectedRoot && observedRoot
                  ? "Observed root received. Expected root not yet recorded locally."
                  : "Both roots are not yet available. Reconciliation will run when data arrives."}
              </p>
            </div>
          </div>
        )}

        {status === "missing" && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h4 className="text-sm font-semibold text-gray-800">No Reconciliation Data</h4>
              <p className="text-sm text-gray-700 mt-1">
                Neither expected nor observed root is available. This run may not have been executed or recorded.
              </p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Privacy notice: This tool compares only batch-level merkle root hashes. Individual employee salaries,
            commitments, and personal data are never fetched, stored, or displayed.
          </p>
        </div>
      </div>
    </section>
  );
}