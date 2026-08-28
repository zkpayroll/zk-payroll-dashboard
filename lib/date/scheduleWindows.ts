import type { PayrollTemplate, PayrollRun } from "@/types/models";

/** yyyy-mm-dd, UTC-normalized so timezone never shifts a date across a day boundary. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUTC(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Adds calendar months to a date, immune to day-count drift (e.g. 31-day months). */
function addMonthsUTC(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

const FREQUENCY_STEP_DAYS: Partial<Record<PayrollTemplate["frequency"], number>> = {
  weekly: 7,
  biweekly: 14,
};

const FREQUENCY_STEP_MONTHS: Partial<Record<PayrollTemplate["frequency"], number>> = {
  monthly: 1,
  quarterly: 3,
};

/**
 * Computes an active template's expected occurrence dates within
 * [rangeStart, rangeEnd] (inclusive), starting from its `nextScheduled` date
 * (or `createdAt` if never scheduled) and stepping forward by its frequency.
 *
 * Monthly/quarterly templates step by calendar months (immune to day-count
 * drift) and snap each occurrence to `dayOfMonth`, clamped to the last day
 * of a shorter month (e.g. day 31 -> Feb 28/29). Weekly/biweekly templates
 * step by a fixed number of days and snap to `dayOfWeek`.
 */
export function computeTemplateOccurrences(
  template: PayrollTemplate,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  if (!template.isActive) return [];

  const anchor = template.nextScheduled
    ? new Date(template.nextScheduled)
    : new Date(template.createdAt);

  // No occurrence can be projected before this template's earliest known
  // occurrence: if it has run before, that's `lastExecuted`; otherwise its
  // very first occurrence is `nextScheduled`/`createdAt` (the anchor itself)
  // — periodic stepping must not project backward past a template's first run.
  const earliestPossible = template.lastExecuted
    ? new Date(template.lastExecuted)
    : anchor;
  const effectiveRangeStart = new Date(
    Math.max(rangeStart.getTime(), earliestPossible.getTime()),
  );

  const isMonthly = template.frequency === "monthly" || template.frequency === "quarterly";
  const stepDays = FREQUENCY_STEP_DAYS[template.frequency];
  const stepMonths = FREQUENCY_STEP_MONTHS[template.frequency];

  const occurrences: Date[] = [];
  const maxIterations = 2000; // guards against a pathological/zero step

  // Walk backward from the anchor (as its snapped occurrence) to cover
  // occurrences before rangeStart too, then forward through rangeEnd.
  let cursor = anchor;
  let iterations = 0;
  while (
    snapToTemplateDay(cursor, template).getTime() > effectiveRangeStart.getTime() &&
    iterations < maxIterations
  ) {
    cursor = isMonthly ? addMonthsUTC(cursor, -(stepMonths ?? 1)) : addDaysUTC(cursor, -(stepDays ?? 1));
    iterations += 1;
  }

  iterations = 0;
  while (iterations < maxIterations) {
    const snapped = snapToTemplateDay(cursor, template);
    if (snapped.getTime() > rangeEnd.getTime()) break;
    if (snapped.getTime() >= rangeStart.getTime()) {
      occurrences.push(snapped);
    }
    cursor = isMonthly ? addMonthsUTC(cursor, stepMonths ?? 1) : addDaysUTC(cursor, stepDays ?? 1);
    iterations += 1;
  }

  return occurrences;
}

function snapToTemplateDay(date: Date, template: PayrollTemplate): Date {
  if (
    (template.frequency === "monthly" || template.frequency === "quarterly") &&
    template.dayOfMonth
  ) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(template.dayOfMonth, lastDayOfMonth);
    return new Date(Date.UTC(year, month, day));
  }

  if (
    (template.frequency === "weekly" || template.frequency === "biweekly") &&
    template.dayOfWeek !== undefined
  ) {
    const delta = (template.dayOfWeek - date.getUTCDay() + 7) % 7;
    return addDaysUTC(date, delta);
  }

  return date;
}

/**
 * A scheduled occurrence that has passed with no corresponding executed run
 * for that template — i.e. a period that was expected but never ran.
 */
export interface MissedOccurrence {
  templateId: string;
  templateName: string;
  date: Date;
}

/**
 * Finds occurrences of active templates that fall strictly before `asOf`
 * but have no matching `PayrollRun` within +/- 3 days of the expected date
 * (a small grace window since runs rarely execute at the exact minute).
 */
export function findMissedOccurrences(
  templates: PayrollTemplate[],
  runs: PayrollRun[],
  rangeStart: Date,
  asOf: Date,
): MissedOccurrence[] {
  const GRACE_DAYS = 3;
  const missed: MissedOccurrence[] = [];

  for (const template of templates) {
    const occurrences = computeTemplateOccurrences(template, rangeStart, asOf);
    for (const occurrence of occurrences) {
      if (occurrence.getTime() >= asOf.getTime()) continue;

      const hasMatchingRun = runs.some((run) => {
        const runDate = new Date(run.timestamp || run.createdAt);
        const diffDays = Math.abs(runDate.getTime() - occurrence.getTime()) / 86_400_000;
        return diffDays <= GRACE_DAYS;
      });

      if (!hasMatchingRun) {
        missed.push({ templateId: template.id, templateName: template.name, date: occurrence });
      }
    }
  }

  return missed;
}

export interface DateRange {
  start: string;
  end: string;
}

/** Whether two inclusive date ranges (yyyy-mm-dd) overlap at all. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export interface OverlapCheckResult {
  hasOverlap: boolean;
  conflictsWith: string[];
}

/**
 * Checks a candidate date range against a list of existing (id, range) pairs,
 * returning which ids it overlaps with. `excludeId` skips a range being
 * edited so it doesn't conflict with its own prior value.
 */
export function findOverlappingWindows(
  candidate: DateRange,
  existing: Array<{ id: string; range: DateRange }>,
  excludeId?: string,
): OverlapCheckResult {
  if (candidate.start > candidate.end) {
    return { hasOverlap: false, conflictsWith: [] };
  }

  const conflictsWith = existing
    .filter((entry) => entry.id !== excludeId)
    .filter((entry) => rangesOverlap(candidate, entry.range))
    .map((entry) => entry.id);

  return { hasOverlap: conflictsWith.length > 0, conflictsWith };
}
