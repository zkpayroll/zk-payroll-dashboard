"use client";

import { useMemo } from "react";
import {
  FileEdit,
  FileSearch,
  Cpu,
  AlertCircle,
  Wallet,
  XCircle,
  CheckCircle2,
  Clock,
  History,
  Shield,
} from "lucide-react";
import {
  usePayrollAuditTrailStore,
  getActionLabel,
  type PayrollApprovalActionType,
  type PayrollApprovalEvent,
} from "@/stores/payrollAuditTrail";

const ACTION_CONFIG: Record<
  PayrollApprovalActionType,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  draft_created: { icon: FileEdit, color: "text-blue-600 bg-blue-50" },
  review_initiated: { icon: FileSearch, color: "text-indigo-600 bg-indigo-50" },
  proof_generated: { icon: Cpu, color: "text-green-600 bg-green-50" },
  proof_failed: { icon: AlertCircle, color: "text-red-600 bg-red-50" },
  wallet_signing: { icon: Wallet, color: "text-purple-600 bg-purple-50" },
  cancelled: { icon: XCircle, color: "text-gray-600 bg-gray-100" },
  submitted: { icon: CheckCircle2, color: "text-green-600 bg-green-50" },
  submission_failed: { icon: AlertCircle, color: "text-red-600 bg-red-50" },
};

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatTimestamp(ts);
}

function TimelineEvent({ event, isLast }: { event: PayrollApprovalEvent; isLast: boolean }) {
  const config = ACTION_CONFIG[event.action];
  const Icon = config.icon;

  return (
    <li className={`relative pb-5 ${isLast ? "" : ""}`}>
      {!isLast && (
        <span
          className="absolute left-[1.15rem] top-10 bottom-0 w-0.5 bg-gray-200"
          aria-hidden="true"
        />
      )}
      <div className="relative flex items-start gap-4">
        <span
          className={`flex items-center justify-center w-9 h-9 rounded-full ${config.color} shrink-0 ring-2 ring-white`}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {getActionLabel(event.action)}
            </span>
            <span className="text-xs text-gray-400">
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>
          {event.details && (
            <p className="text-sm text-gray-600 mt-0.5">{event.details}</p>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {event.actor}
              {event.actorRole && ` (${event.actorRole})`}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimestamp(event.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

interface PayrollApprovalAuditTrailProps {
  payrollRunId: string;
  compact?: boolean;
}

export default function PayrollApprovalAuditTrail({
  payrollRunId,
  compact = false,
}: PayrollApprovalAuditTrailProps) {
  const allEvents = usePayrollAuditTrailStore((s) => s.events);

  const sorted = useMemo(
    () =>
      allEvents
        .filter((e) => e.payrollRunId === payrollRunId)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
    [allEvents, payrollRunId],
  );

  if (sorted.length === 0) {
    if (compact) return null;
    return (
      <section aria-labelledby="approval-audit-heading" className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-400" />
          <h3 id="approval-audit-heading" className="text-sm font-semibold text-gray-900">
            Approval Audit Trail
          </h3>
        </div>
        <div className="bg-white rounded-lg border border-dashed border-gray-200 p-6 text-center">
          <Clock className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No approval events recorded yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Events are logged as you progress through the payroll workflow.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="approval-audit-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <History className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-indigo-600`} />
        <h3
          id="approval-audit-heading"
          className={`font-semibold text-gray-900 ${compact ? "text-xs" : "text-sm"}`}
        >
          Approval Audit Trail
        </h3>
        <span className="text-xs text-gray-400 ml-auto">
          {sorted.length} event{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        className={`bg-white rounded-lg border ${compact ? "p-3" : "p-4"}`}
      >
        <ol
          className={`relative ${compact ? "pl-0" : "pl-1"}`}
          aria-label="Payroll approval audit trail timeline"
        >
          {sorted.map((event, index) => (
            <TimelineEvent
              key={event.id}
              event={event}
              isLast={index === sorted.length - 1}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
