/**
 * Period label derivation and formatting for payroll list and detail screens.
 *
 * Privacy-safe: Only parses and formats date and period metadata (ISO timestamps,
 * period IDs, quarterly/monthly labels). Never processes, displays, or logs
 * private employee salary amounts, wallets, or confidential payloads.
 */

export type PeriodFormatStyle = "long" | "short" | "id";

export interface PeriodLabelOptions {
  /**
   * Fallback string displayed when date/period is missing or invalid.
   * @default "Unassigned period"
   */
  fallback?: string;
  /**
   * Formatting style:
   * - "long": e.g. "February 2025", "Q1 2026"
   * - "short": e.g. "Feb 2025", "Q1 2026"
   * - "id": e.g. "2025-02", "2026-Q1"
   * @default "long"
   */
  format?: PeriodFormatStyle;
  /**
   * Optional prefix to prepend to valid formatted labels (e.g. "Period: ").
   */
  prefix?: string;
}

export interface ParsedPeriod {
  isValid: boolean;
  label: string;
  shortLabel: string;
  periodId: string;
  year: number | null;
  month: number | null; // 1-12 when applicable
  quarter?: number | null; // 1-4 when applicable
  error?: string;
}

const MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_INDEX_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/**
 * Extract raw period identifier or timestamp candidate from various input shapes.
 */
function extractRawValue(input: unknown): string | Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string") return input.trim();
  if (typeof input === "number" && !Number.isNaN(input) && input > 0) {
    return new Date(input);
  }

  if (typeof input === "object") {
    const record = input as Record<string, unknown>;
    const candidates = [
      record.payPeriod,
      record.payrollPeriodId,
      record.period,
      record.periodId,
      record.createdAt,
      record.timestamp,
      record.date,
      record.executedAt,
    ];

    for (const val of candidates) {
      if (typeof val === "string" && val.trim().length > 0) {
        return val.trim();
      }
      if (val instanceof Date) {
        return val;
      }
    }
  }

  return null;
}

/**
 * Parse an arbitrary period identifier, date string, or payroll run object.
 * Always UTC-normalized to avoid timezone shifts across day or month boundaries.
 */
export function parsePeriod(input: unknown): ParsedPeriod {
  const raw = extractRawValue(input);
  if (!raw) {
    return {
      isValid: false,
      label: "",
      shortLabel: "",
      periodId: "",
      year: null,
      month: null,
      error: "Missing or empty period input",
    };
  }

  // Handle Date objects
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      return {
        isValid: false,
        label: "",
        shortLabel: "",
        periodId: "",
        year: null,
        month: null,
        error: "Invalid Date object",
      };
    }
    const year = raw.getUTCFullYear();
    const month = raw.getUTCMonth() + 1; // 1-indexed
    const longMonth = MONTH_NAMES_LONG[month - 1];
    const shortMonth = MONTH_NAMES_SHORT[month - 1];
    const periodId = `${year}-${String(month).padStart(2, "0")}`;

    return {
      isValid: true,
      label: `${longMonth} ${year}`,
      shortLabel: `${shortMonth} ${year}`,
      periodId,
      year,
      month,
    };
  }

  const str = raw.trim();

  // Pattern 1: ISO YYYY-MM (e.g. "2025-02", "2026-07")
  const yyyyMmMatch = /^(\d{4})[-_/](\d{1,2})$/.exec(str);
  if (yyyyMmMatch) {
    const year = Number.parseInt(yyyyMmMatch[1], 10);
    const month = Number.parseInt(yyyyMmMatch[2], 10);
    if (month >= 1 && month <= 12) {
      const longMonth = MONTH_NAMES_LONG[month - 1];
      const shortMonth = MONTH_NAMES_SHORT[month - 1];
      const periodId = `${year}-${String(month).padStart(2, "0")}`;
      return {
        isValid: true,
        label: `${longMonth} ${year}`,
        shortLabel: `${shortMonth} ${year}`,
        periodId,
        year,
        month,
      };
    }
  }

  // Pattern 2: period_YYYY_MM or payroll_period_YYYY_MM (e.g. "period_2026_01")
  const prefixedMatch = /(?:period|payroll_period)[-_](\d{4})[-_](\d{1,2})/i.exec(str);
  if (prefixedMatch) {
    const year = Number.parseInt(prefixedMatch[1], 10);
    const month = Number.parseInt(prefixedMatch[2], 10);
    if (month >= 1 && month <= 12) {
      const longMonth = MONTH_NAMES_LONG[month - 1];
      const shortMonth = MONTH_NAMES_SHORT[month - 1];
      const periodId = `${year}-${String(month).padStart(2, "0")}`;
      return {
        isValid: true,
        label: `${longMonth} ${year}`,
        shortLabel: `${shortMonth} ${year}`,
        periodId,
        year,
        month,
      };
    }
  }

  // Pattern 3: Quarterly format (e.g. "Q1 2026", "2026-Q1", "2026 Q3")
  const qFirstMatch = /^Q([1-4])\s*[-_/]?\s*(\d{4})$/i.exec(str);
  const qLastMatch = /^(\d{4})\s*[-_/]?\s*Q([1-4])$/i.exec(str);
  if (qFirstMatch || qLastMatch) {
    const quarter = Number.parseInt(qFirstMatch ? qFirstMatch[1] : qLastMatch![2], 10);
    const year = Number.parseInt(qFirstMatch ? qFirstMatch[2] : qLastMatch![1], 10);
    const label = `Q${quarter} ${year}`;
    const periodId = `${year}-Q${quarter}`;
    return {
      isValid: true,
      label,
      shortLabel: label,
      periodId,
      year,
      month: (quarter - 1) * 3 + 1,
      quarter,
    };
  }

  // Pattern 4: Named month + year (e.g. "March 2026", "Aug 2025", "February 2025")
  const namedMatch = /^([A-Za-z]+)\s*[-_/]?\s*(\d{4})$/.exec(str);
  if (namedMatch) {
    const monthKey = namedMatch[1].toLowerCase();
    const year = Number.parseInt(namedMatch[2], 10);
    const month = MONTH_INDEX_MAP[monthKey];
    if (month && month >= 1 && month <= 12) {
      const longMonth = MONTH_NAMES_LONG[month - 1];
      const shortMonth = MONTH_NAMES_SHORT[month - 1];
      const periodId = `${year}-${String(month).padStart(2, "0")}`;
      return {
        isValid: true,
        label: `${longMonth} ${year}`,
        shortLabel: `${shortMonth} ${year}`,
        periodId,
        year,
        month,
      };
    }
  }

  // Pattern 5: Full ISO date/timestamp (e.g. "2025-02-28T09:01:00Z", "2026-03-15")
  const dateAttempt = new Date(str);
  if (!Number.isNaN(dateAttempt.getTime())) {
    const year = dateAttempt.getUTCFullYear();
    const month = dateAttempt.getUTCMonth() + 1;
    const longMonth = MONTH_NAMES_LONG[month - 1];
    const shortMonth = MONTH_NAMES_SHORT[month - 1];
    const periodId = `${year}-${String(month).padStart(2, "0")}`;
    return {
      isValid: true,
      label: `${longMonth} ${year}`,
      shortLabel: `${shortMonth} ${year}`,
      periodId,
      year,
      month,
    };
  }

  return {
    isValid: false,
    label: "",
    shortLabel: "",
    periodId: "",
    year: null,
    month: null,
    error: `Unrecognized period format: "${str}"`,
  };
}

/**
 * Format a payroll period into a clean, human-readable label.
 *
 * @example
 * formatPeriodLabel("2025-02-28T09:01:00Z") // "February 2025"
 * formatPeriodLabel("2026-07") // "July 2026"
 * formatPeriodLabel({ createdAt: "2025-03-31T00:00:00Z" }) // "March 2025"
 * formatPeriodLabel("invalid", { fallback: "No period" }) // "No period"
 */
export function formatPeriodLabel(
  input: unknown,
  options: PeriodLabelOptions = {}
): string {
  const { fallback = "Unassigned period", format = "long", prefix = "" } = options;
  const parsed = parsePeriod(input);

  if (!parsed.isValid) {
    return fallback;
  }

  let formattedValue: string;
  switch (format) {
    case "short":
      formattedValue = parsed.shortLabel;
      break;
    case "id":
      formattedValue = parsed.periodId;
      break;
    case "long":
    default:
      formattedValue = parsed.label;
      break;
  }

  return prefix ? `${prefix}${formattedValue}` : formattedValue;
}

/**
 * Shorthand to format a compact period label (e.g. "Feb 2025").
 */
export function formatShortPeriodLabel(
  input: unknown,
  fallback = "Unassigned"
): string {
  return formatPeriodLabel(input, { format: "short", fallback });
}

/**
 * Shorthand to extract or generate the ISO period ID (e.g. "2025-02").
 */
export function formatPeriodId(
  input: unknown,
  fallback = ""
): string {
  return formatPeriodLabel(input, { format: "id", fallback });
}

/**
 * Check if the provided input resolves to a valid payroll period.
 */
export function isPeriodValid(input: unknown): boolean {
  return parsePeriod(input).isValid;
}
