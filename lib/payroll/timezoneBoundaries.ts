import { isValidIANATimeZone } from "@/lib/payroll/timezoneDisplay";

export type PayrollBoundaryPlacement = "before" | "within" | "after";

export interface PayrollTimezoneBoundaryInput {
  startUtc: string | Date;
  endUtc: string | Date;
  timeZone: string;
}

export interface PayrollTimezoneBoundaryEvaluation {
  valid: boolean;
  error: string | null;
  timeZone: string;
  startUtc: string | null;
  endUtc: string | null;
  startUtcDateKey: string | null;
  endUtcDateKey: string | null;
  startZoneDateKey: string | null;
  endZoneDateKey: string | null;
  startShiftedAcrossDay: boolean;
  endShiftedAcrossDay: boolean;
  spansMultipleZoneDays: boolean;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date;
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function zoneDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

export function getZoneDateKey(value: string | Date, timeZone: string): string | null {
  if (!isValidIANATimeZone(timeZone)) return null;
  const date = toDate(value);
  if (!date) return null;
  return zoneDateKey(date, timeZone);
}

function invalidEvaluation(
  timeZone: string,
  error: string,
): PayrollTimezoneBoundaryEvaluation {
  return {
    valid: false,
    error,
    timeZone,
    startUtc: null,
    endUtc: null,
    startUtcDateKey: null,
    endUtcDateKey: null,
    startZoneDateKey: null,
    endZoneDateKey: null,
    startShiftedAcrossDay: false,
    endShiftedAcrossDay: false,
    spansMultipleZoneDays: false,
  };
}

/**
 * Evaluate a payroll period window against a display timezone.
 *
 * The window is always stored as UTC instants; the evaluation reports which
 * calendar day each boundary falls on in the requested zone so operators can
 * see when a UTC boundary lands on a different local day. Stored timestamps
 * are never rewritten — only the derived date keys are zone-aware.
 */
export function evaluatePayrollTimezoneBoundary(
  input: PayrollTimezoneBoundaryInput,
): PayrollTimezoneBoundaryEvaluation {
  const timeZone = input?.timeZone ?? "";

  if (!isValidIANATimeZone(timeZone)) {
    return invalidEvaluation(
      timeZone,
      `"${timeZone}" is not a valid IANA timezone. Choose a supported timezone (for example "UTC" or "Africa/Lagos") and try again.`,
    );
  }

  const start = toDate(input?.startUtc);
  if (!start) {
    return invalidEvaluation(
      timeZone,
      "The payroll window start is not a valid date. Correct the period start and try again.",
    );
  }

  const end = toDate(input?.endUtc);
  if (!end) {
    return invalidEvaluation(
      timeZone,
      "The payroll window end is not a valid date. Correct the period end and try again.",
    );
  }

  if (end.getTime() < start.getTime()) {
    return invalidEvaluation(
      timeZone,
      "The payroll window ends before it starts. Correct the period boundaries and try again.",
    );
  }

  const startUtcDateKey = utcDateKey(start);
  const endUtcDateKey = utcDateKey(end);
  const startZoneDateKey = zoneDateKey(start, timeZone);
  const endZoneDateKey = zoneDateKey(end, timeZone);

  return {
    valid: true,
    error: null,
    timeZone,
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
    startUtcDateKey,
    endUtcDateKey,
    startZoneDateKey,
    endZoneDateKey,
    startShiftedAcrossDay: startZoneDateKey !== startUtcDateKey,
    endShiftedAcrossDay: endZoneDateKey !== endUtcDateKey,
    spansMultipleZoneDays: startZoneDateKey !== endZoneDateKey,
  };
}

/**
 * Classify an instant against the window in the given timezone.
 * The boundary instants themselves count as `within` (inclusive window).
 * Returns `null` when the instant or the window input is unusable.
 */
export function classifyPayrollInstant(
  value: string | Date,
  input: PayrollTimezoneBoundaryInput,
): PayrollBoundaryPlacement | null {
  const evaluation = evaluatePayrollTimezoneBoundary(input);
  if (!evaluation.valid) return null;

  const instant = toDate(value);
  if (!instant) return null;

  const time = instant.getTime();
  const start = new Date(evaluation.startUtc as string).getTime();
  const end = new Date(evaluation.endUtc as string).getTime();

  if (time < start) return "before";
  if (time > end) return "after";
  return "within";
}

export function describePayrollTimezoneBoundary(
  evaluation: PayrollTimezoneBoundaryEvaluation,
): string {
  if (!evaluation.valid) {
    return evaluation.error ?? "Payroll window boundaries are unavailable.";
  }

  const {
    timeZone,
    startUtcDateKey,
    endUtcDateKey,
    startZoneDateKey,
    endZoneDateKey,
    startShiftedAcrossDay,
    endShiftedAcrossDay,
  } = evaluation;

  const sentences = [
    `In ${timeZone} this payroll window runs from ${startZoneDateKey} to ${endZoneDateKey}.`,
  ];

  if (startShiftedAcrossDay) {
    sentences.push(
      `The window opens on ${startUtcDateKey} in UTC, which is already ${startZoneDateKey} in ${timeZone}.`,
    );
  }
  if (endShiftedAcrossDay) {
    sentences.push(
      `The window closes on ${endUtcDateKey} in UTC, which is already ${endZoneDateKey} in ${timeZone}.`,
    );
  }
  if (!startShiftedAcrossDay && !endShiftedAcrossDay) {
    sentences.push("Calendar-day boundaries match UTC, so no date shifts at either edge.");
  }

  sentences.push(
    "Stored UTC timestamps are unchanged; only the displayed dates follow the selected timezone.",
  );

  return sentences.join(" ");
}
