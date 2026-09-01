"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  Clock,
  XCircle,
} from "lucide-react";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { PayrollRun } from "@/types/models";
import EmptyState from "@/components/ui/EmptyState";
import { useHelpDrawer, HELP_CONTENT } from "@/stores/helpDrawer";
import PayrollDetailSheet from "@/components/features/payroll/PayrollDetailSheet";
import PeriodLabelBadge from "@/components/features/payroll/PeriodLabelBadge";
import {
  classifyRun,
  formatPayrollDate,
  formatPayrollMonthYear,
  getCalendarMonthDays,
  getDominantRunKind,
  getHeatmapIntensity,
  getNextUpcoming,
  getRunDate,
  groupRunsByDateKey,
  RUN_KIND_STYLES,
  sortRunsForSchedule,
  toDateKey,
  type RunScheduleKind,
} from "@/lib/payroll/scheduleUtils";

interface PayrollCalendarProps {
  runs?: PayrollRun[];
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function RunKindIcon({ kind }: { kind: RunScheduleKind }) {
  if (kind === "completed") {
    return <CheckCircle className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />;
  }
  if (kind === "failed") {
    return <XCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />;
  }
  if (kind === "pending_approval") {
    return <AlertCircle className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />;
  }
  return <Clock className="w-4 h-4 text-yellow-600 shrink-0" aria-hidden="true" />;
}

function RunBadge({ kind }: { kind: RunScheduleKind }) {
  const styles = RUN_KIND_STYLES[kind];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${styles.badge}`}
    >
      {styles.label}
    </span>
  );
}

function RunListItem({ run }: { run: PayrollRun }) {
  const kind = classifyRun(run);
  const styles = RUN_KIND_STYLES[kind];
  const date = getRunDate(run);

  return (
    <li>
      <Link
        href={`/payroll/${run.id}`}
        className={`flex items-start gap-3 p-4 rounded-lg border transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${styles.badge}`}
      >
        <RunKindIcon kind={kind} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {formatPayrollDate(date)}
            </span>
            <PeriodLabelBadge period={run} size="xs" variant="pill" />
            <RunBadge kind={kind} />
          </div>
          <p className="text-sm text-gray-600 mt-0.5">
            ${run.totalAmount.toLocaleString()} · {run.employeeCount} employees
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
      </Link>
    </li>
  );
}

function MobileRunListItem({ run, onSelect }: { run: PayrollRun; onSelect: (run: PayrollRun) => void }) {
  const kind = classifyRun(run);
  const styles = RUN_KIND_STYLES[kind];
  const date = getRunDate(run);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(run)}
        className={`w-full flex items-start gap-3 p-4 rounded-lg border transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 text-left ${styles.badge}`}
      >
        <RunKindIcon kind={kind} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {formatPayrollDate(date)}
            </span>
            <PeriodLabelBadge period={run} size="xs" variant="pill" />
            <RunBadge kind={kind} />
          </div>
          <p className="text-sm text-gray-600 mt-0.5">
            ${run.totalAmount.toLocaleString()} · {run.employeeCount} employees
          </p>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
      </button>
    </li>
  );
}

function NextUpHero({ run }: { run: PayrollRun }) {
  const date = getRunDate(run);

  return (
    <article className="bg-white rounded-lg shadow-sm border-2 border-indigo-200 overflow-hidden">
      <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Next payroll run
        </p>
      </div>
      <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-yellow-700" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold text-gray-900">{formatPayrollDate(date)}</p>
              <PeriodLabelBadge period={run} size="sm" variant="badge" />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              ${run.totalAmount.toLocaleString()} across {run.employeeCount} employees
            </p>
            <div className="mt-1">
              <RunBadge kind="scheduled" />
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Link
            href={`/payroll/${run.id}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-indigo-200 bg-white text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors"
          >
            View details
          </Link>
          <Link
            href="/payroll/execute"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Process now
          </Link>
        </div>
      </div>
    </article>
  );
}

function MonthCalendar({
  runsByDate,
  viewDate,
  onPrevMonth,
  onNextMonth,
}: {
  runsByDate: Map<string, PayrollRun[]>;
  viewDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();
  const days = getCalendarMonthDays(year, month);

  const todayKey = toDateKey(new Date());

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {formatPayrollMonthYear(viewDate)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
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
            <div
              key={label}
              className="text-center text-xs font-medium text-gray-500 py-1"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Payroll calendar heatmap">
          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const dateKey = toDateKey(day);
            const dayRuns = runsByDate.get(dateKey) ?? [];
            const isToday = dateKey === todayKey;
            const dominantKind = getDominantRunKind(dayRuns);
            const intensity = getHeatmapIntensity(dayRuns);
            const heatBg = dominantKind
              ? RUN_KIND_STYLES[dominantKind].heatBg[Math.max(0, intensity - 1)]
              : "";
            const heatSummary = dayRuns.length
              ? `, ${dayRuns.length} run${dayRuns.length > 1 ? "s" : ""} (${dominantKind ? RUN_KIND_STYLES[dominantKind].label.toLowerCase() : "activity"})`
              : "";

            return (
              <div
                key={dateKey}
                role="gridcell"
                aria-label={`${formatPayrollDate(day)}${heatSummary}`}
                title={dayRuns.length ? `${dayRuns.length} run${dayRuns.length > 1 ? "s" : ""} on ${formatPayrollDate(day)}` : undefined}
                className={`aspect-square p-1 rounded-md border transition-colors ${
                  isToday ? "border-indigo-300" : "border-transparent"
                } ${heatBg || (dayRuns.length === 0 ? "" : "bg-gray-50")}`}
              >
                <span
                  className={`block text-xs font-medium mb-0.5 ${
                    isToday ? "text-indigo-700" : "text-gray-700"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="space-y-0.5">
                  {dayRuns.slice(0, 2).map((run) => {
                    const kind = classifyRun(run);
                    return (
                      <Link
                        key={run.id}
                        href={`/payroll/${run.id}`}
                        className={`block w-full h-1.5 rounded-full ${RUN_KIND_STYLES[kind].dot} hover:opacity-80`}
                        title={`${RUN_KIND_STYLES[kind].label}: ${formatPayrollDate(getRunDate(run))}`}
                        aria-label={`${RUN_KIND_STYLES[kind].label} payroll on ${formatPayrollDate(getRunDate(run))}`}
                      />
                    );
                  })}
                  {dayRuns.length > 2 && (
                    <span className="text-[10px] text-gray-500">+{dayRuns.length - 2}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" aria-hidden="true" />
            Scheduled
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" aria-hidden="true" />
            Pending approval
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" aria-hidden="true" />
            Completed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true" />
            Failed
          </span>
          <span className="inline-flex items-center gap-1.5 ml-auto text-gray-400">
            Darker = busier day
          </span>
        </div>
      </div>
    </div>
  );
}

function PayrollCalendar({ runs = MOCK_PAYROLL_RUNS }: PayrollCalendarProps) {
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { openHelp } = useHelpDrawer();

  const handleRunSelect = useCallback((run: PayrollRun) => {
    setSelectedRun(run);
    setSheetOpen(true);
  }, []);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setSelectedRun(null);
    }
  }, []);

  const nextUp = useMemo(() => getNextUpcoming(runs), [runs]);
  const sortedRuns = useMemo(() => sortRunsForSchedule(runs), [runs]);
  const runsByDate = useMemo(() => groupRunsByDateKey(runs), [runs]);
  const pastRuns = useMemo(
    () => runs.filter((r) => classifyRun(r) !== "scheduled"),
    [runs],
  );
  const scheduledRuns = useMemo(
    () => runs.filter((r) => classifyRun(r) === "scheduled"),
    [runs],
  );

  const initialViewDate = nextUp ? getRunDate(nextUp) : new Date();
  const [viewDate, setViewDate] = useState(
    () => new Date(Date.UTC(initialViewDate.getUTCFullYear(), initialViewDate.getUTCMonth(), 1)),
  );

  const shiftMonth = (delta: number) => {
    setViewDate((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1)));
  };


  if (runs.length === 0) {
    return (
      <section aria-labelledby="payroll-schedule-heading">
        <header className="mb-6">
          <h2 id="payroll-schedule-heading" className="text-lg font-semibold text-gray-900">
            Payroll Schedule
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Upcoming and historical payroll runs at a glance
          </p>
        </header>
        <div className="bg-white rounded-lg shadow-sm">
          <EmptyState
            icon={Calendar}
            title="No payroll runs yet"
            description="When you schedule your first payroll run, it will appear here on your calendar."
            action={{
              label: "Start first payroll run",
              href: "/payroll/execute",
            }}
            secondaryAction={{
              label: "View payroll guide",
              onClick: () => {
                const content = HELP_CONTENT.payroll;
                if (content) openHelp("payroll", content);
              },
            }}
          />
        </div>
      </section>
    );
  }

  const isFirstRunOnly = scheduledRuns.length === 1 && pastRuns.length === 0;

  return (
    <section aria-labelledby="payroll-schedule-heading" className="space-y-6">
      <header>
        <h2 id="payroll-schedule-heading" className="text-lg font-semibold text-gray-900">
          Payroll Schedule
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Upcoming and historical payroll runs at a glance
        </p>
      </header>

      {nextUp && <NextUpHero run={nextUp} />}

      <div className="hidden md:block">
        <MonthCalendar
          runsByDate={runsByDate}
          viewDate={viewDate}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
        />
      </div>

      <div className="md:hidden bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="text-base font-medium text-gray-900">Timeline</h3>
          <p className="text-xs text-gray-500 mt-0.5">Tap a run for details</p>
        </div>
        <ul className="divide-y divide-gray-100 p-3 space-y-2">
          {sortedRuns.map((run) => (
            <MobileRunListItem key={run.id} run={run} onSelect={handleRunSelect} />
          ))}
        </ul>
      </div>

      {isFirstRunOnly ? (
        <article className="bg-white rounded-lg shadow-sm p-6 border border-dashed border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Getting started</h3>
          <p className="text-sm text-gray-600 mt-1">
            Your first payroll run is on the calendar above. Once it completes, past runs will
            appear in the history section below.
          </p>
          <Link
            href="/payroll/execute"
            className="inline-flex mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Prepare payroll run →
          </Link>
        </article>
      ) : (
        pastRuns.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">Past payroll runs</h3>
            </div>
            <ul className="hidden md:block divide-y divide-gray-100">
              {pastRuns.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/payroll/${run.id}`}
                    className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <RunKindIcon kind={classifyRun(run)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {formatPayrollDate(getRunDate(run))}
                        </p>
                        <PeriodLabelBadge period={run} size="xs" variant="pill" />
                      </div>
                      <p className="text-sm text-gray-500">
                        ${run.totalAmount.toLocaleString()} · {run.employeeCount} employees
                      </p>
                    </div>
                    <RunBadge kind={classifyRun(run)} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      )}

      {scheduledRuns.length > 1 && (
        <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-medium text-gray-900">Other scheduled runs</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {scheduledRuns
              .filter((run) => run.id !== nextUp?.id)
              .map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/payroll/${run.id}`}
                    className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <RunKindIcon kind="scheduled" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {formatPayrollDate(getRunDate(run))}
                        </p>
                        <PeriodLabelBadge period={run} size="xs" variant="pill" />
                      </div>
                      <p className="text-sm text-gray-500">
                        ${run.totalAmount.toLocaleString()} · {run.employeeCount} employees
                      </p>
                    </div>
                    <RunBadge kind="scheduled" />
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}

      <PayrollDetailSheet
        run={selectedRun}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
      />
    </section>
  );
}

export default PayrollCalendar;
