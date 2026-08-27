"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  Merge,
  XCircle,
  X,
  ArrowRight,
} from "lucide-react";
import {
  useEmployeeImportStore,
  hashEmployeeRef,
  computeDifferingFields,
} from "@/stores/employeeImport";
import type {
  DuplicateCluster,
  DuplicateResolution,
  EmployeeImportRecord,
} from "@/types/import";

// ─── Confidence badge ──────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const isExact = confidence === "exact";
  return (
    <span
      data-testid={`confidence-badge-${confidence}`}
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
        isExact
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {isExact ? "Exact Match" : "Likely Match"}
    </span>
  );
}

// ─── Redacted record preview ───────────────────────────────────────────────

function RedactedRecordRow({
  record,
  isPrimary,
  differingFields,
}: {
  record: EmployeeImportRecord;
  isPrimary: boolean;
  differingFields: string[];
}) {
  const refHash = hashEmployeeRef(record.rowId);

  return (
    <div
      data-testid={`redacted-record-${refHash}`}
      className={`flex items-center gap-3 px-3 py-2 rounded-md ${
        isPrimary ? "bg-blue-50 border border-blue-200" : "bg-gray-50 border border-gray-200"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-600">{refHash}</span>
          {isPrimary && (
            <span className="text-xs text-blue-600 font-medium">Primary</span>
          )}
        </div>
        {record.department && (
          <p className="text-xs text-gray-500 mt-0.5">{record.department}</p>
        )}
      </div>
      {differingFields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {differingFields.map((field) => (
            <span
              key={field}
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-600 border border-amber-200"
            >
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Resolution action buttons ─────────────────────────────────────────────

function ResolutionActions({
  clusterId,
  currentResolution,
}: {
  clusterId: string;
  currentResolution: DuplicateResolution | null;
}) {
  const resolveCluster = useEmployeeImportStore((s) => s.resolveCluster);

  const actions: {
    key: DuplicateResolution;
    label: string;
    icon: typeof Merge;
    color: string;
  }[] = [
    { key: "merge", label: "Merge", icon: Merge, color: "text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200" },
    { key: "keep_separate", label: "Keep Separate", icon: ArrowRight, color: "text-green-700 bg-green-50 hover:bg-green-100 border-green-200" },
    { key: "dismiss", label: "Dismiss", icon: XCircle, color: "text-gray-700 bg-gray-50 hover:bg-gray-100 border-gray-200" },
    { key: "request_review", label: "Request Review", icon: Eye, color: "text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200" },
  ];

  return (
    <div className="flex flex-wrap gap-2" data-testid={`resolution-actions-${clusterId}`}>
      {actions.map(({ key, label, icon: Icon, color }) => (
        <button
          key={key}
          onClick={() => resolveCluster(clusterId, key)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            color
          } ${currentResolution === key ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
          data-testid={`resolve-${key}-${clusterId}`}
          aria-label={`Resolve as ${label}`}
        >
          <Icon className="w-3 h-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Duplicate cluster card ────────────────────────────────────────────────

function DuplicateClusterCard({
  cluster,
}: {
  cluster: DuplicateCluster;
}) {
  const [expanded, setExpanded] = useState(false);

  const resolutionLabel = useMemo(() => {
    switch (cluster.resolution) {
      case "merge":
        return "Merged";
      case "keep_separate":
        return "Keeping Separate";
      case "dismiss":
        return "Dismissed";
      case "request_review":
        return "Review Requested";
      default:
        return null;
    }
  }, [cluster.resolution]);

  const isResolved = cluster.resolution !== null;

  return (
    <div
      data-testid={`duplicate-cluster-${cluster.id}`}
      className={`rounded-lg border ${
        isResolved
          ? "border-gray-200 bg-gray-50"
          : cluster.blocksImport
          ? "border-red-300 bg-white"
          : "border-amber-300 bg-white"
      } shadow-sm`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <ConfidenceBadge confidence={cluster.confidence} />
          <span className="text-sm font-medium text-gray-900">
            {cluster.records.length} records
          </span>
          {cluster.blocksImport && !isResolved && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="w-3 h-3" />
              Blocks import
            </span>
          )}
          {isResolved && (
            <span className="inline-flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="w-3 h-3" />
              {resolutionLabel}
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          aria-label={expanded ? "Collapse cluster" : "Expand cluster"}
        >
          {expanded ? "Less" : "Details"}
        </button>
      </div>

      {/* Matched-on fields */}
      <div className="px-4 pb-2">
        <p className="text-xs text-gray-400">
          Matched on: {cluster.matchedOn.join(", ")}
        </p>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2" data-testid={`cluster-details-${cluster.id}`}>
          {cluster.previews.map((preview, idx) => (
            <RedactedRecordRow
              key={preview.refHash}
              record={cluster.records[idx]}
              isPrimary={idx === 0}
              differingFields={preview.differingFields}
            />
          ))}
        </div>
      )}

      {/* Resolution actions */}
      {!isResolved && (
        <div className="px-4 pb-3">
          <ResolutionActions
            clusterId={cluster.id}
            currentResolution={cluster.resolution}
          />
        </div>
      )}

      {/* Review notes */}
      {cluster.reviewNotes && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 italic">{cluster.reviewNotes}</p>
        </div>
      )}
    </div>
  );
}

// ─── DuplicateResolutionPanel ──────────────────────────────────────────────

export interface DuplicateResolutionPanelProps {
  /** Whether the panel is open */
  isOpen?: boolean;
  /** Callback to close the panel */
  onClose?: () => void;
}

/**
 * Full duplicate resolution panel for employee import review.
 * Groups duplicate records into clusters and allows admins to resolve them.
 * Sensitive employee fields are always shown as redacted reference hashes.
 */
export default function DuplicateResolutionPanel({
  isOpen = true,
  onClose,
}: DuplicateResolutionPanelProps) {
  const session = useEmployeeImportStore((s) => s.session);
  const { duplicateClusters, unresolvedCriticalCount, canFinalize } = session;

  const summary = useMemo(() => {
    const total = duplicateClusters.length;
    const resolved = duplicateClusters.filter((c) => c.resolution !== null).length;
    const critical = duplicateClusters.filter((c) => c.blocksImport).length;
    return { total, resolved, critical };
  }, [duplicateClusters]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="duplicate-resolution-panel"
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900">
            Duplicate Resolution
          </h3>
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            {summary.total}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {summary.resolved} of {summary.total} clusters resolved
          </span>
          <span>
            {unresolvedCriticalCount} critical{" "}
            {unresolvedCriticalCount === 1 ? "cluster" : "clusters"} remaining
          </span>
        </div>
        {!canFinalize && (
          <p className="text-xs text-red-600 mt-1">
            Resolve all critical duplicate clusters before finalizing the import.
          </p>
        )}
      </div>

      {/* Cluster list */}
      {duplicateClusters.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">
          No duplicate clusters detected. All records are unique.
        </div>
      ) : (
        <div className="p-4 space-y-3" data-testid="cluster-list">
          {duplicateClusters.map((cluster) => (
            <DuplicateClusterCard key={cluster.id} cluster={cluster} />
          ))}
        </div>
      )}
    </div>
  );
}
