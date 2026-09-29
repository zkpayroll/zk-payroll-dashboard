"use client";

import React, { useState } from "react";
import { History, ChevronDown, ChevronUp, Eye, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfigurationChange {
  field: string;
  oldValue: string | null;
  newValue: string;
}

export interface RevisionHistoryEntry {
  id: string;
  timestamp: string;
  changedBy: string;
  changeType: "created" | "updated" | "restored";
  changes: ConfigurationChange[];
  reason?: string;
  version: number;
}

export interface EmployerConfigurationRevisionHistoryProps {
  companyId: string;
  revisions: RevisionHistoryEntry[];
  className?: string;
  onViewDetails?: (revision: RevisionHistoryEntry) => void;
  onExport?: (revision: RevisionHistoryEntry) => void;
}

function ChangeTypeLabel({
  type,
}: {
  type: RevisionHistoryEntry["changeType"];
}) {
  const config = {
    created: {
      bg: "bg-green-100",
      text: "text-green-700",
      label: "Created",
    },
    updated: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      label: "Updated",
    },
    restored: {
      bg: "bg-purple-100",
      text: "text-purple-700",
      label: "Restored",
    },
  };

  const style = config[type];
  return (
    <span className={cn("px-2 py-1 rounded text-xs font-medium", style.bg, style.text)}>
      {style.label}
    </span>
  );
}

export function EmployerConfigurationRevisionHistory({
  companyId,
  revisions,
  className,
  onViewDetails,
  onExport,
}: EmployerConfigurationRevisionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (revisions.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-gray-200 bg-white p-6 text-center",
          className,
        )}
        data-testid="empty-revision-history"
      >
        <History className="h-12 w-12 mx-auto text-gray-300 mb-3" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-900">No revision history</p>
        <p className="text-xs text-gray-600 mt-1">
          Configuration revisions will appear here when changes are made.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-lg border border-gray-200 bg-white", className)}
      data-testid="employer-config-revision-history"
    >
      <div className="border-b border-gray-200 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-gray-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900">
            Configuration Revision History
          </h3>
          <span className="ml-auto text-xs text-gray-600">
            {revisions.length} revision{revisions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Company: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-900">{companyId}</code>
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {revisions.map((revision) => (
          <div key={revision.id} className="transition-colors hover:bg-gray-50">
            <button
              onClick={() =>
                setExpandedId(expandedId === revision.id ? null : revision.id)
              }
              className="w-full px-4 py-3 sm:px-6 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={expandedId === revision.id}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ChangeTypeLabel type={revision.changeType} />
                    <span className="text-xs font-mono text-gray-600">
                      v{revision.version}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 text-xs text-gray-600">
                    <span>
                      {new Date(revision.timestamp).toLocaleString()}
                    </span>
                    <span className="hidden sm:inline">by {revision.changedBy}</span>
                  </div>
                  {revision.reason && (
                    <p className="text-xs text-gray-700 mt-1 font-medium">
                      {revision.reason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {onExport && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExport(revision);
                      }}
                      className="p-2 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="Export revision"
                    >
                      <Download className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    {expandedId === revision.id ? (
                      <ChevronUp className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </button>

            {expandedId === revision.id && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">
                      Changes ({revision.changes.length})
                    </h4>
                    <div className="space-y-2">
                      {revision.changes.map((change, idx) => (
                        <div
                          key={idx}
                          data-testid={`change-item-${idx}`}
                          className="bg-white rounded border border-gray-200 p-2"
                        >
                          <p className="text-xs font-medium text-gray-900">
                            {change.field}
                          </p>
                          <div className="text-xs mt-1 space-y-1">
                            {change.oldValue && (
                              <div>
                                <span className="text-gray-600">From:</span>{" "}
                                <code className="bg-red-50 text-red-900 px-1.5 py-0.5 rounded font-mono text-xs">
                                  {change.oldValue}
                                </code>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-600">To:</span>{" "}
                              <code className="bg-green-50 text-green-900 px-1.5 py-0.5 rounded font-mono text-xs">
                                {change.newValue}
                              </code>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {onViewDetails && (
                    <button
                      onClick={() => onViewDetails(revision)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      View full details
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default EmployerConfigurationRevisionHistory;
