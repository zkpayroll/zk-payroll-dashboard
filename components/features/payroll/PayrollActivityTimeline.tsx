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
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import {
  usePayrollAuditTrailStore,
  getActionLabel,
} from "@/stores/payrollAuditTrail";
import type {
  PayrollApprovalActionType,
  PayrollApprovalEvent,
} from "@/stores/payrollAuditTrail";

// ─── Icon / colour config ─────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  PayrollApprovalActionType,
  { icon: React.ComponentType<{ className?: string }>; colour: string }
> = {
  draft_created:     { icon: FileEdit,     colour: "text-blue-600 bg-blue-50 ring-blue-100"    },
  review_initiated:  { icon: FileSearch,   colour: "text-indigo-600 bg-indigo-50 ring-indigo-100" },
  proof_generated:   { icon: Cpu,          colour: "text-green-600 bg-green-50 ring-green-100"  },
  proof_failed:      { icon: AlertCircle,  colour: "text-red-600 bg-red-50 ring-red-100"        },
  wallet_signing:    { icon: Wallet,       colour: "text-purple-600 bg-purple-50 ring-purple-100" },
  cancelled:         { icon: XCircle,      colour: "text-gray-500 bg-gray-100 ring-gray-200"   },
  submitted:         { icon: CheckCircle2, colour: "text-green-600 bg-green-50 ring-green-100"  },
  submission_failed: { icon: ShieldAlert,  colour: "text-red-600 bg-red-50 ring-red-100"        },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAbsolute(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(ts: string): string {
  const diffMs = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Single event row ─────────────────────────────────────────────────────────

function TimelineRow({
  event,
  isLast,
}: {
  event: PayrollApprovalEvent;
  isLast: boolean;
}) {
  const cfg = ACTION_CONFIG[event.action];
  const Icon = cfg.icon;

  return (
    <li className="relative pb-5">
      {/* Vertical connector */}
      {!isLast && (
        <span
          className="absolute left-[1.125rem] top-9 bottom-0 w-px bg-gray-200"
          aria-hidden="true"
        />
      )}

      <div className="relative flex items-start gap-3">
        {/* Icon badge */}
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ring-2 ${cfg.colour}`}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-gray-900">
              {getActionLabel(event.action)}
            </span>
            <time
              dateTime={event.timestamp}
              title={formatAbsolute(event.timestamp)}
              className="text-xs text-gray-400"
            >
              {formatRelative(event.timestamp)}
            </time>
          </div>

          {/* Safe detail line — never shows raw salary amounts */}
          {event.details && (
            <p className="mt-0.5 text-sm text-gray-600 break-words">
              {event.details}
            </p>
          )}

          {/* Actor metadata */}
          <p className="mt-1 text-xs text-gray-400">
            {event.actor}
            {event.actorRole ? ` · ${event.actorRole}` : ""}
            <span className="mx-1" aria-hidden="true">·</span>
            <time dateTime={event.timestamp}>{formatAbsolute(event.timestamp)}</time>
          </p>
        </div>
      </div>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PayrollActivityTimelineProps {
  /**
   * Filter to a single payroll run.  When omitted the timeline shows events
   * for all runs (useful on the admin overview page).
   */
  payrollRunId?: string;
  /**
   * Maximum number of events to display.  The most-recent events are shown
   * first (chronologically descending).  Defaults to showing all events.
   */
  maxEvents?: number;
  /** Compact mode reduces padding and font sizes. */
  compact?: boolean;
  className?: string;
}

/**
 * Renders a chronological timeline of payroll activity events sourced from
 * `usePayrollAuditTrailStore`.
 *
 * Privacy:
 * - Events are displayed exactly as stored — `logEvent` callers are
 *   responsible for keeping `details` free of raw salary amounts.
 * - The timeline itself never derives or displays financial values.
 *
 * Accessibility:
 * - The list uses `role="list"` / `<li>` semantics so AT users can navigate
 *   by item.
 * - The `<section>` is labelled with `aria-labelledby`.
 * - Timestamps use `<time dateTime>` for machine-readable values.
 */
export function PayrollActivityTimeline({
  payrollRunId,
  maxEvents,
  compact = false,
  className = "",
}: PayrollActivityTimelineProps) {
  const allEvents = usePayrollAuditTrailStore((s) => s.events);

  const events: PayrollApprovalEvent[] = useMemo(() => {
    const filtered = payrollRunId
      ? allEvents.filter((e) => e.payrollRunId === payrollRunId)
      : [...allEvents];

    // Chronological ascending (oldest first → natural reading order)
    filtered.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return maxEvents !== undefined ? filtered.slice(-maxEvents) : filtered;
  }, [allEvents, payrollRunId, maxEvents]);

  const headingId = `pat-heading-${payrollRunId ?? "all"}`;

  return (
    <section
      aria-labelledby={headingId}
      className={`${className}`}
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History
            className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} text-indigo-600`}
            aria-hidden="true"
          />
          <h3
            id={headingId}
            className={`font-semibold text-gray-900 ${compact ? "text-xs" : "text-sm"}`}
          >
            {payrollRunId ? "Run Activity" : "Payroll Activity"}
          </h3>
        </div>

        {events.length > 0 && (
          <span className="text-xs text-gray-400">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center">
          <Clock
            className="mx-auto mb-2 h-6 w-6 text-gray-300"
            aria-hidden="true"
          />
          <p className="text-sm text-gray-500">No activity recorded yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Events appear here as the payroll workflow progresses.
          </p>
        </div>
      )}

      {/* Timeline list */}
      {events.length > 0 && (
        <div className={`rounded-lg border border-gray-200 bg-white ${compact ? "p-3" : "p-4"}`}>
          <ol
            aria-label={
              payrollRunId
                ? `Activity timeline for payroll run ${payrollRunId}`
                : "Payroll activity timeline"
            }
            className={compact ? "pl-0" : "pl-1"}
          >
            {events.map((event, idx) => (
              <TimelineRow
                key={event.id}
                event={event}
                isLast={idx === events.length - 1}
              />
            ))}
          </ol>

          {maxEvents !== undefined &&
            allEvents.length > maxEvents && (
              <p className="mt-2 text-center text-xs text-gray-400">
                Showing the {maxEvents} most recent events.
              </p>
            )}
        </div>
      )}
    </section>
  );
}

// ─── Refresh wrapper ──────────────────────────────────────────────────────────

/**
 * Thin wrapper that adds a "Refresh" button which re-reads the store.
 * Useful when the timeline is shown in a polling or real-time context.
 */
export function RefreshablePayrollActivityTimeline(
  props: PayrollActivityTimelineProps,
) {
  // Force a re-render by toggling a key. The store itself is the source of
  // truth; toggling the key re-subscribes the child component.
  const [key, setKey] = useSafeToggle();

  return (
    <div>
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Refresh activity timeline"
        >
          <RefreshCcw className="h-3 w-3" aria-hidden="true" />
          Refresh
        </button>
      </div>
      <PayrollActivityTimeline key={key} {...props} />
    </div>
  );
}

// tiny helper — avoids importing useState in the JSX above
function useSafeToggle(): [number, React.Dispatch<React.SetStateAction<number>>] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useState } = require("react") as typeof import("react");
  return useState<number>(0);
}
