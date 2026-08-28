"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, Lock, CalendarClock, Save } from "lucide-react";
import { toast } from "sonner";
import { MOCK_PAYROLL_TEMPLATES, MOCK_PAYROLL_LOCKS, MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import { getCalendarMonthDays, formatPayrollMonthYear } from "@/lib/payroll/scheduleUtils";
import {
  computeTemplateOccurrences,
  findMissedOccurrences,
  toDateKey,
} from "@/lib/date/scheduleWindows";
import { useDraftScheduleWindowStore } from "@/stores/draftScheduleWindows";
import EmptyState from "@/components/ui/EmptyState";
import type { PayrollTemplate } from "@/types/models";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayEntry {
  kind: "occurrence" | "lock" | "missed";
  label: string;
}

function DraftWindowForm({ templates }: { templates: PayrollTemplate[] }) {
  const upsertDraft = useDraftScheduleWindowStore((s) => s.upsertDraft);

  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSubmittable = templateId && windowStart && windowEnd;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmittable) return;

    if (windowStart > windowEnd) {
      setError("Window start must be on or before window end.");
      return;
    }

    const result = upsertDraft({ templateId, windowStart, windowEnd });

    if (!result.success) {
      setError(
        `This window overlaps with ${result.conflictsWith.length} existing draft window${
          result.conflictsWith.length === 1 ? "" : "s"
        }.`,
      );
      toast.error("Overlapping settlement window", {
        description: "Adjust the dates so drafts don't overlap.",
      });
      return;
    }

    setError(null);
    setWindowStart("");
    setWindowEnd("");
    toast.success("Draft settlement window saved", {
      description: "This is a draft — submit the policy to apply it.",
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
      aria-label="Add settlement window"
    >
      <h3 className="text-sm font-semibold text-gray-900">Draft a settlement window</h3>

      <div>
        <label htmlFor="schedule-template" className="block text-xs font-medium text-gray-700 mb-1">
          Recurring template
        </label>
        <select
          id="schedule-template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="window-start" className="block text-xs font-medium text-gray-700 mb-1">
            Window start
          </label>
          <input
            id="window-start"
            type="date"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label htmlFor="window-end" className="block text-xs font-medium text-gray-700 mb-1">
            Window end
          </label>
          <input
            id="window-end"
            type="date"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isSubmittable}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
      >
        <Save className="w-4 h-4" aria-hidden="true" />
        Save draft window
      </button>
    </form>
  );
}

function PayrollScheduleEditor({
  templates = MOCK_PAYROLL_TEMPLATES,
  locks = MOCK_PAYROLL_LOCKS,
  runs = MOCK_PAYROLL_RUNS,
  initialViewDate,
}: {
  templates?: PayrollTemplate[];
  locks?: typeof MOCK_PAYROLL_LOCKS;
  runs?: typeof MOCK_PAYROLL_RUNS;
  /** Month to open the calendar on. Defaults to the current month. */
  initialViewDate?: Date;
}) {
  const now = useMemo(() => initialViewDate ?? new Date(), [initialViewDate]);
  const [viewDate, setViewDate] = useState(
    () => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  );
  const drafts = useDraftScheduleWindowStore((s) => s.drafts);

  const activeTemplates = useMemo(() => templates.filter((t) => t.isActive), [templates]);

  const monthDays = useMemo(
    () => getCalendarMonthDays(viewDate.getUTCFullYear(), viewDate.getUTCMonth()),
    [viewDate],
  );

  const rangeStart = useMemo(
    () => new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1)),
    [viewDate],
  );
  const rangeEnd = useMemo(
    () => new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, 0)),
    [viewDate],
  );

  const entriesByDate = useMemo(() => {
    const map = new Map<string, DayEntry[]>();

    const pushEntry = (dateKey: string, entry: DayEntry) => {
      const existing = map.get(dateKey) ?? [];
      existing.push(entry);
      map.set(dateKey, existing);
    };

    for (const template of activeTemplates) {
      for (const occurrence of computeTemplateOccurrences(template, rangeStart, rangeEnd)) {
        pushEntry(toDateKey(occurrence), { kind: "occurrence", label: template.name });
      }
    }

    for (const lock of locks) {
      if (lock.isResolved) continue;
      pushEntry(toDateKey(new Date(lock.lockedAt)), { kind: "lock", label: lock.reasonDescription });
    }

    const missed = findMissedOccurrences(activeTemplates, runs, rangeStart, now);
    for (const m of missed) {
      pushEntry(toDateKey(m.date), { kind: "missed", label: `${m.templateName} (missed)` });
    }

    return map;
  }, [activeTemplates, locks, runs, rangeStart, rangeEnd, now]);

  const shiftMonth = (delta: number) => {
    setViewDate((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)));
  };

  if (activeTemplates.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No active recurring schedules"
        description="Activate a recurring payroll template to see it on the schedule editor."
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="payroll-schedule-editor">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Payroll Schedule Editor</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upcoming settlement windows, execution windows, missed periods, and locks at a glance.
        </p>
      </div>

      <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{formatPayrollMonthYear(viewDate)}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-center text-xs font-medium text-gray-500 py-1">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Payroll schedule calendar">
            {monthDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }
              const dateKey = toDateKey(day);
              const entries = entriesByDate.get(dateKey) ?? [];
              const hasMissed = entries.some((e) => e.kind === "missed");
              const hasLock = entries.some((e) => e.kind === "lock");

              return (
                <div
                  key={dateKey}
                  role="gridcell"
                  aria-label={`${dateKey}${entries.length ? `, ${entries.map((e) => e.label).join(", ")}` : ""}`}
                  className={`aspect-square p-1 rounded-md border ${
                    hasMissed ? "border-red-200 bg-red-50" : hasLock ? "border-amber-200 bg-amber-50" : "border-transparent"
                  }`}
                >
                  <span className="block text-xs font-medium text-gray-700 mb-0.5">{day.getUTCDate()}</span>
                  <div className="space-y-0.5">
                    {entries.slice(0, 2).map((entry, i) => (
                      <div
                        key={i}
                        title={entry.label}
                        className={`text-[9px] truncate rounded px-1 ${
                          entry.kind === "missed"
                            ? "bg-red-200 text-red-900"
                            : entry.kind === "lock"
                              ? "bg-amber-200 text-amber-900"
                              : "bg-indigo-100 text-indigo-800"
                        }`}
                      >
                        {entry.kind === "lock" && <Lock className="inline w-2 h-2 mr-0.5" aria-hidden="true" />}
                        {entry.label}
                      </div>
                    ))}
                    {entries.length > 2 && (
                      <span className="text-[9px] text-gray-500">+{entries.length - 2} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t text-xs text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" aria-hidden="true" />
              Scheduled execution
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true" />
              Locked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true" />
              Missed
            </span>
          </div>
        </div>
      </div>

      <div className="md:hidden bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-900">{formatPayrollMonthYear(viewDate)}</h3>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <ul className="divide-y divide-gray-100 p-3 space-y-2">
          {Array.from(entriesByDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateKey, entries]) => (
              <li key={dateKey} className="p-3 rounded-lg border border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{dateKey}</p>
                <ul className="mt-1 space-y-1">
                  {entries.map((entry, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                      {entry.kind === "lock" && <Lock className="w-3 h-3 text-amber-600" aria-hidden="true" />}
                      {entry.kind === "missed" && <AlertTriangle className="w-3 h-3 text-red-600" aria-hidden="true" />}
                      {entry.label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          {entriesByDate.size === 0 && (
            <li className="text-sm text-gray-500 text-center py-6">No scheduled activity this month.</li>
          )}
        </ul>
      </div>

      <DraftWindowForm templates={activeTemplates} />

      {drafts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Draft settlement windows</h3>
          <ul className="space-y-2">
            {drafts.map((draft) => {
              const template = templates.find((t) => t.id === draft.templateId);
              return (
                <li key={draft.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                  <span className="text-gray-700">{template?.name ?? draft.templateId}</span>
                  <span className="text-gray-500 font-mono text-xs">
                    {draft.windowStart} → {draft.windowEnd}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default PayrollScheduleEditor;
