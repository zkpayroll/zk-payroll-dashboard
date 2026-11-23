/**
 * Payroll Period Boundary Recovery Flow (#884).
 *
 * Provides pure decision logic, recovery planning, and action runners for
 * resolving invalid, inverted, overlapping, or timezone-shifted payroll period
 * boundaries (settlement windows).
 *
 * Security & Privacy:
 * - Never touches or renders individual employee names, IDs, salaries, or wallet keys.
 * - All recovery calculations are strictly based on calendar dates (YYYY-MM-DD),
 *   template IDs, and duration arithmetic.
 */

import {
  validatePayrollPeriodBoundaries,
  rangesOverlap,
  type DateRange,
} from "@/lib/date/scheduleWindows";
import {
  evaluatePayrollTimezoneBoundary,
} from "@/lib/payroll/timezoneBoundaries";
import type {
  ConflictingBoundaryWindow,
  PeriodBoundaryDateRange,
  PeriodBoundaryRecoveryAction,
  PeriodBoundaryRecoveryActionOption,
  PeriodBoundaryRecoveryEvaluationInput,
  PeriodBoundaryRecoveryPlan,
  PeriodBoundaryRecoveryResult,
  PeriodBoundaryStatus,
} from "@/types/periodBoundary";

/** Converts a Date to YYYY-MM-DD in UTC. */
export function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a YYYY-MM-DD string into a UTC midnight Date object. */
export function parseUtcDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== dateKey) return null;
  return date;
}

/** Adds calendar days to an ISO date key (YYYY-MM-DD). */
export function addDaysToDateKey(dateKey: string, days: number): string | null {
  const parsed = parseUtcDateKey(dateKey);
  if (!parsed) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatUtcDateKey(parsed);
}

/** Calculates inclusive days between two date keys. */
export function daysBetweenDateKeys(startKey: string, endKey: string): number | null {
  const start = parseUtcDateKey(startKey);
  const end = parseUtcDateKey(endKey);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / 86_400_000) + 1;
}

/** Standard interval duration in days for template frequencies. */
export function getFrequencyDurationDays(
  frequency?: "weekly" | "biweekly" | "monthly" | "quarterly",
): number {
  switch (frequency) {
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "quarterly":
      return 90;
    case "monthly":
    default:
      return 30;
  }
}

/**
 * Calculates a standard period window from a start date given a frequency.
 * For monthly, snaps to the calendar month end if starting on day 1.
 */
export function calculateStandardWindow(
  startKey: string,
  frequency?: "weekly" | "biweekly" | "monthly" | "quarterly",
): PeriodBoundaryDateRange | null {
  const start = parseUtcDateKey(startKey);
  if (!start) return null;

  if (frequency === "monthly" && start.getUTCDate() === 1) {
    const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    return {
      start: startKey,
      end: formatUtcDateKey(nextMonth),
    };
  }

  const durationDays = getFrequencyDurationDays(frequency);
  const endKey = addDaysToDateKey(startKey, durationDays - 1);
  if (!endKey) return null;

  return { start: startKey, end: endKey };
}

/**
 * Finds the earliest non-overlapping date range starting on or after the conflicting
 * windows end, maintaining the requested duration.
 */
export function findNextAvailableWindow(
  candidateDurationDays: number,
  conflictingWindows: ConflictingBoundaryWindow[],
  allExistingWindows: ConflictingBoundaryWindow[],
  excludeId?: string,
): PeriodBoundaryDateRange | null {
  if (conflictingWindows.length === 0) return null;

  const validExisting = allExistingWindows
    .filter((w) => w.id !== excludeId)
    .filter((w) => parseUtcDateKey(w.start) && parseUtcDateKey(w.end))
    .sort((a, b) => a.start.localeCompare(b.start));

  // Find the latest end date among the conflicting windows
  const latestConflictingEnd = conflictingWindows.reduce((maxEnd, current) => {
    return current.end > maxEnd ? current.end : maxEnd;
  }, conflictingWindows[0].end);

  const duration = Math.max(1, candidateDurationDays);

  let searchStart = addDaysToDateKey(latestConflictingEnd, 1);
  if (!searchStart) return null;

  let iterations = 0;
  const maxIterations = 365;

  while (iterations < maxIterations) {
    const candidateEnd = addDaysToDateKey(searchStart, duration - 1);
    if (!candidateEnd) return null;

    const testRange: DateRange = { start: searchStart, end: candidateEnd };
    const collision = validExisting.find((w) =>
      rangesOverlap(testRange, { start: w.start, end: w.end }),
    );

    if (!collision) {
      return { start: searchStart, end: candidateEnd };
    }

    // Step past the newly colliding window's end date
    const nextStart = addDaysToDateKey(collision.end, 1);
    if (!nextStart || nextStart <= searchStart) {
      break;
    }
    searchStart = nextStart;
    iterations += 1;
  }

  return null;
}

/**
 * Evaluates payroll period boundaries against existing windows and validation rules,
 * constructing an actionable recovery plan.
 */
export function evaluatePeriodBoundaryRecovery(
  input: PeriodBoundaryRecoveryEvaluationInput,
): PeriodBoundaryRecoveryPlan {
  const start = input.start?.trim() ?? "";
  const end = input.end?.trim() ?? "";
  const candidate: PeriodBoundaryDateRange = { start, end };
  const excludeId = input.excludeId;

  // Normalize existing windows
  const normalizedExisting: ConflictingBoundaryWindow[] = (input.existingWindows ?? [])
    .map((w) => ({
      id: w.id,
      templateId: w.templateId,
      templateName: w.templateName,
      start: w.start ?? w.windowStart ?? "",
      end: w.end ?? w.windowEnd ?? "",
    }))
    .filter((w) => w.start && w.end);

  // 1. Check date validity using the canonical validator without modifying it
  const boundaryValidation = validatePayrollPeriodBoundaries(start, end);

  // Determine specific validation failure mode
  if (!boundaryValidation.valid) {
    const startValid = parseUtcDateKey(start) !== null;
    const endValid = parseUtcDateKey(end) !== null;

    if (!startValid) {
      const today = formatUtcDateKey(new Date());
      const suggested = calculateStandardWindow(today, input.templateFrequency) ?? {
        start: today,
        end: addDaysToDateKey(today, 13) ?? today,
      };

      return {
        status: "invalid_start",
        valid: false,
        candidate,
        recommendedAction: "align_to_preceding",
        actionableMessage:
          "The payroll period start date is invalid. Choose a valid calendar date (YYYY-MM-DD) to open the window.",
        suggestedWindow: suggested,
        conflictingWindows: [],
        crossTemplateConflict: false,
        actions: [
          {
            action: "align_to_preceding",
            label: "Use Today as Start",
            description: `Set window start to ${today} and extend for a standard period.`,
            suggestedWindow: suggested,
            enabled: true,
          },
        ],
      };
    }

    if (!endValid) {
      const suggested = calculateStandardWindow(start, input.templateFrequency) ?? {
        start,
        end: addDaysToDateKey(start, 13) ?? start,
      };

      return {
        status: "invalid_end",
        valid: false,
        candidate,
        recommendedAction: "expand_standard_window",
        actionableMessage:
          "The payroll period end date is invalid. Choose a valid calendar date (YYYY-MM-DD) on or after the start date.",
        suggestedWindow: suggested,
        conflictingWindows: [],
        crossTemplateConflict: false,
        actions: [
          {
            action: "expand_standard_window",
            label: "Expand to Standard Period",
            description: `Extend end date to ${suggested.end} based on scheduled frequency.`,
            suggestedWindow: suggested,
            enabled: true,
          },
        ],
      };
    }

    if (start > end) {
      // Inverted boundaries: start is after end
      const swappedRange: PeriodBoundaryDateRange = { start: end, end: start };
      const singleDayRange: PeriodBoundaryDateRange = { start, end: start };

      return {
        status: "inverted",
        valid: false,
        candidate,
        recommendedAction: "swap_dates",
        actionableMessage:
          "The payroll period end date falls before the start date. Swap the dates or set a valid chronological window.",
        suggestedWindow: swappedRange,
        conflictingWindows: [],
        crossTemplateConflict: false,
        actions: [
          {
            action: "swap_dates",
            label: "Swap Start and End Dates",
            description: `Flip boundaries so window runs from ${swappedRange.start} to ${swappedRange.end}.`,
            suggestedWindow: swappedRange,
            enabled: true,
          },
          {
            action: "expand_standard_window",
            label: "Set Single-Day Period",
            description: `Align end date with start date (${singleDayRange.start}).`,
            suggestedWindow: singleDayRange,
            enabled: true,
          },
        ],
      };
    }
  }

  // 2. Dates are valid calendar dates with start <= end. Check for overlaps.
  const candidateDuration = (daysBetweenDateKeys(start, end) ?? 1);
  const candidateRange: DateRange = { start, end };

  const conflicts = normalizedExisting
    .filter((w) => w.id !== excludeId)
    .filter((w) => rangesOverlap(candidateRange, { start: w.start, end: w.end }));

  if (conflicts.length > 0) {
    const isSameTemplate = (w: ConflictingBoundaryWindow) =>
      input.templateId && w.templateId === input.templateId;

    const hasCrossTemplate = conflicts.some(
      (w) => input.templateId && w.templateId && w.templateId !== input.templateId,
    );

    const conflictingTemplateNames = Array.from(
      new Set(conflicts.map((w) => w.templateName || w.templateId || "draft schedule")),
    );

    const nextAvailable = findNextAvailableWindow(
      candidateDuration,
      conflicts,
      normalizedExisting,
      excludeId,
    );

    const actions: PeriodBoundaryRecoveryActionOption[] = [];

    if (nextAvailable) {
      actions.push({
        action: "shift_next_available",
        label: "Shift to Next Available Window",
        description: `Move window to ${nextAvailable.start} → ${nextAvailable.end} after the conflicting period ends.`,
        suggestedWindow: nextAvailable,
        enabled: true,
      });
    }

    actions.push({
      action: "clear_conflicts",
      label: "Clear Conflicting Drafts",
      description: "Remove conflicting draft settlement windows to make room for this period.",
      enabled: true,
    });

    const conflictDetail = hasCrossTemplate
      ? `from ${conflictingTemplateNames.join(", ")}`
      : "in this schedule";

    return {
      status: "overlap",
      valid: false,
      candidate,
      recommendedAction: nextAvailable ? "shift_next_available" : "clear_conflicts",
      actionableMessage: `This settlement window overlaps with ${conflicts.length} existing window${
        conflicts.length === 1 ? "" : "s"
      } ${conflictDetail}. Shift the dates or clear conflicting drafts to continue.`,
      suggestedWindow: nextAvailable,
      conflictingWindows: conflicts,
      crossTemplateConflict: hasCrossTemplate,
      actions,
    };
  }

  // 3. Check for timezone shift / day boundary spillover if timezone provided
  if (input.timeZone) {
    const tzEval = evaluatePayrollTimezoneBoundary({
      startUtc: `${start}T00:00:00Z`,
      endUtc: `${end}T23:59:59Z`,
      timeZone: input.timeZone,
    });

    if (tzEval.valid && (tzEval.startShiftedAcrossDay || tzEval.endShiftedAcrossDay)) {
      return {
        status: "timezone_spillover",
        valid: true,
        candidate,
        recommendedAction: "none",
        actionableMessage: `Window boundaries shift across calendar days in ${input.timeZone} (${tzEval.startZoneDateKey} → ${tzEval.endZoneDateKey}). Stored UTC boundaries remain intact.`,
        suggestedWindow: null,
        conflictingWindows: [],
        crossTemplateConflict: false,
        actions: [
          {
            action: "align_timezone",
            label: "Acknowledge Timezone Boundary Shift",
            description: `Local displayed window runs from ${tzEval.startZoneDateKey} to ${tzEval.endZoneDateKey}.`,
            enabled: true,
          },
        ],
      };
    }
  }

  // 4. Healthy / valid window
  return {
    status: "healthy",
    valid: true,
    candidate,
    recommendedAction: "none",
    actionableMessage: "Settlement window boundaries are valid and non-overlapping.",
    suggestedWindow: null,
    conflictingWindows: [],
    crossTemplateConflict: false,
    actions: [],
  };
}

/**
 * Applies a specific recovery action to an invalid or conflicting period boundary.
 */
export function applyPeriodBoundaryRecoveryAction(
  action: PeriodBoundaryRecoveryAction,
  input: PeriodBoundaryRecoveryEvaluationInput,
): PeriodBoundaryRecoveryResult {
  const plan = evaluatePeriodBoundaryRecovery(input);

  switch (action) {
    case "swap_dates": {
      const swapped: PeriodBoundaryDateRange = {
        start: input.end?.trim() ?? "",
        end: input.start?.trim() ?? "",
      };
      if (swapped.start > swapped.end) {
        return { ok: false, action, error: "Cannot swap: dates remain inverted." };
      }
      return { ok: true, action, recoveredWindow: swapped };
    }

    case "shift_next_available": {
      if (plan.suggestedWindow) {
        return { ok: true, action, recoveredWindow: plan.suggestedWindow };
      }
      return {
        ok: false,
        action,
        error: "Unable to calculate next available non-overlapping window.",
      };
    }

    case "expand_standard_window": {
      if (plan.suggestedWindow) {
        return { ok: true, action, recoveredWindow: plan.suggestedWindow };
      }
      const standard = calculateStandardWindow(input.start, input.templateFrequency);
      if (standard) {
        return { ok: true, action, recoveredWindow: standard };
      }
      return { ok: false, action, error: "Unable to expand window." };
    }

    case "align_to_preceding": {
      if (plan.suggestedWindow) {
        return { ok: true, action, recoveredWindow: plan.suggestedWindow };
      }
      const today = formatUtcDateKey(new Date());
      const standard = calculateStandardWindow(today, input.templateFrequency);
      return { ok: true, action, recoveredWindow: standard ?? { start: today, end: today } };
    }

    case "clear_conflicts": {
      return { ok: true, action, recoveredWindow: plan.candidate };
    }

    case "none":
    default:
      return { ok: true, action: "none", recoveredWindow: plan.candidate };
  }
}
