"use client";

import { useState } from "react";
import {
  Key,
  KeyRound,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  Shield,
  Download,
} from "lucide-react";
import {
  useAuditActivityStore,
  MOCK_AUDIT_ACTIVITIES,
} from "@/stores/auditActivity";
import type { AuditActivityEntry, AuditActionType } from "@/stores/auditActivity";

const ACTION_CONFIG: Record<
  AuditActionType,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  key_granted: { icon: Key, color: "text-green-600 bg-green-50", label: "Key Granted" },
  key_revoked: { icon: KeyRound, color: "text-red-600 bg-red-50", label: "Key Revoked" },
  request_approved: { icon: CheckCircle, color: "text-green-600 bg-green-50", label: "Request Approved" },
  request_rejected: { icon: XCircle, color: "text-red-600 bg-red-50", label: "Request Rejected" },
  export_prepared: { icon: Shield, color: "text-indigo-600 bg-indigo-50", label: "Export Prepared" },
  export_downloaded: { icon: Download, color: "text-green-600 bg-green-50", label: "Export Downloaded" },
};

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

function AuditActivityFeed() {
  const { activities: storedActivities, setActivities } = useAuditActivityStore();
  const [initialized, setInitialized] = useState(false);

  if (!initialized && storedActivities.length === 0) {
    setActivities(MOCK_AUDIT_ACTIVITIES);
    setInitialized(true);
  }

  const activities = storedActivities.length > 0 ? storedActivities : MOCK_AUDIT_ACTIVITIES;

  return (
    <section aria-labelledby="audit-activity-heading" className="space-y-4">
      <div>
        <h3
          id="audit-activity-heading"
          className="text-sm font-semibold text-gray-900 flex items-center gap-2"
        >
          <Shield className="w-4 h-4 text-indigo-600" />
          Audit Activity Timeline
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Track when audit access was granted, used, or revoked. No private payroll values are exposed.
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="bg-white rounded-lg border p-6 text-center">
          <Clock className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No audit activity recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <ol
            className="relative pl-8 pr-4 py-4 space-y-0"
            aria-label="Audit activity timeline"
          >
            {activities
              .slice()
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .map((entry, index, sorted) => (
                <TimelineItem
                  key={entry.id}
                  entry={entry}
                  isLast={index === sorted.length - 1}
                />
              ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function TimelineItem({
  entry,
  isLast,
}: {
  entry: AuditActivityEntry;
  isLast: boolean;
}) {
  const config = ACTION_CONFIG[entry.action];
  const Icon = config.icon;

  return (
    <li className={`relative pb-6 ${isLast ? "" : ""}`}>
      {!isLast && (
        <span
          className="absolute left-[-1.15rem] top-8 bottom-0 w-px bg-gray-200"
          aria-hidden="true"
        />
      )}
      <div className="relative flex items-start gap-3">
        <span
          className={`absolute left-[-1.75rem] flex items-center justify-center w-6 h-6 rounded-full ${config.color}`}
          aria-hidden="true"
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-900">
              {config.label}
            </span>
            {entry.scope && (
              <span
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                  entry.scope === "full-audit"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {entry.scope === "full-audit" ? "Full Audit" : "Read-only"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 mt-0.5">{entry.summary}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              {entry.actor}
              {entry.actorOrg && (
                <span>({entry.actorOrg})</span>
              )}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimestamp(entry.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

export default AuditActivityFeed;
