/**
 * Adjacent Payroll Period Boundary Explanation & Resolution for Audit Grants.
 *
 * Privacy-safe: Operates strictly on period metadata, date timestamps, and scope intervals.
 * Never accesses, processes, or logs unmasked salary commitments, employee identities,
 * or confidential proof secrets.
 */

export type BoundaryRelationship =
  | "continuous"
  | "gap"
  | "overlap"
  | "reversed"
  | "invalid";

export interface PayrollPeriodBoundary {
  periodId: string;
  periodLabel: string;
  startUtc: string | Date;
  endUtc: string | Date;
  timeZone?: string;
}

export interface AdjacentPeriodBoundaryExplanation {
  valid: boolean;
  relationship: BoundaryRelationship;
  boundaryTimestamp: string | null;
  periodAInterval: string;
  periodBInterval: string;
  intervalConvention: string;
  boundaryResolution: string;
  summary: string;
  privacyGuarantee: string;
  gapMs?: number;
  overlapMs?: number;
  error?: string;
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d;
}

function formatIso(date: Date): string {
  return date.toISOString();
}

/**
 * Explains and validates the boundary between two adjacent payroll periods in an audit grant.
 * Evaluates half-open intervals [start, end) where start is inclusive and end is exclusive.
 */
export function explainAdjacentPeriodBoundaries(
  prevPeriod: PayrollPeriodBoundary,
  nextPeriod: PayrollPeriodBoundary,
  timeZone: string = "UTC"
): AdjacentPeriodBoundaryExplanation {
  const startA = parseDate(prevPeriod?.startUtc);
  const endA = parseDate(prevPeriod?.endUtc);
  const startB = parseDate(nextPeriod?.startUtc);
  const endB = parseDate(nextPeriod?.endUtc);

  const defaultConvention =
    "Half-open interval [start, end) — start timestamp is inclusive, end timestamp is exclusive.";
  const privacyNote =
    "Zero-knowledge privacy guarantee: Period boundaries evaluate only temporal metadata; employee salaries, balances, and recipient wallets remain cryptographically sealed.";

  if (!startA || !endA || !startB || !endB) {
    return {
      valid: false,
      relationship: "invalid",
      boundaryTimestamp: null,
      periodAInterval: "Invalid Period A",
      periodBInterval: "Invalid Period B",
      intervalConvention: defaultConvention,
      boundaryResolution: "Cannot resolve boundaries due to missing or invalid timestamps.",
      summary: "Invalid period timestamps provided for audit grant boundary evaluation.",
      privacyGuarantee: privacyNote,
      error: "One or more period boundary dates could not be parsed.",
    };
  }

  if (startA.getTime() >= endA.getTime()) {
    return {
      valid: false,
      relationship: "invalid",
      boundaryTimestamp: null,
      periodAInterval: `[${formatIso(startA)}, ${formatIso(endA)})`,
      periodBInterval: `[${formatIso(startB)}, ${formatIso(endB)})`,
      intervalConvention: defaultConvention,
      boundaryResolution: "Period A end timestamp must occur strictly after start timestamp.",
      summary: "Malformed interval: Period A start is not before end.",
      privacyGuarantee: privacyNote,
      error: "Period A start timestamp is greater than or equal to its end timestamp.",
    };
  }

  if (startB.getTime() >= endB.getTime()) {
    return {
      valid: false,
      relationship: "invalid",
      boundaryTimestamp: null,
      periodAInterval: `[${formatIso(startA)}, ${formatIso(endA)})`,
      periodBInterval: `[${formatIso(startB)}, ${formatIso(endB)})`,
      intervalConvention: defaultConvention,
      boundaryResolution: "Period B end timestamp must occur strictly after start timestamp.",
      summary: "Malformed interval: Period B start is not before end.",
      privacyGuarantee: privacyNote,
      error: "Period B start timestamp is greater than or equal to its end timestamp.",
    };
  }

  const intervalA = `[${formatIso(startA)}, ${formatIso(endA)})`;
  const intervalB = `[${formatIso(startB)}, ${formatIso(endB)})`;

  if (startA.getTime() > startB.getTime()) {
    return {
      valid: false,
      relationship: "reversed",
      boundaryTimestamp: null,
      periodAInterval: intervalA,
      periodBInterval: intervalB,
      intervalConvention: defaultConvention,
      boundaryResolution: "Periods must be chronologically ordered (Period A before Period B).",
      summary: "Reversed period sequence detected. Period A begins after Period B.",
      privacyGuarantee: privacyNote,
      error: "Chronological inversion: Period A occurs after Period B.",
    };
  }

  const diffMs = startB.getTime() - endA.getTime();

  if (diffMs === 0) {
    return {
      valid: true,
      relationship: "continuous",
      boundaryTimestamp: formatIso(endA),
      periodAInterval: intervalA,
      periodBInterval: intervalB,
      intervalConvention: defaultConvention,
      boundaryResolution: `Events timestamped exactly at boundary ${formatIso(endA)} belong exclusively to succeeding period '${nextPeriod.periodLabel}' (${nextPeriod.periodId}).`,
      summary: `Periods '${prevPeriod.periodLabel}' and '${nextPeriod.periodLabel}' form a seamless, continuous adjacent boundary with zero gap or overlap.`,
      privacyGuarantee: privacyNote,
      gapMs: 0,
      overlapMs: 0,
    };
  }

  if (diffMs < 0) {
    const overlapMs = Math.abs(diffMs);
    const overlapHours = (overlapMs / (1000 * 60 * 60)).toFixed(1);
    return {
      valid: false,
      relationship: "overlap",
      boundaryTimestamp: formatIso(startB),
      periodAInterval: intervalA,
      periodBInterval: intervalB,
      intervalConvention: defaultConvention,
      boundaryResolution: "Overlapping boundaries require administrative reconciliation to prevent double-counting of payroll state transitions.",
      summary: `Periods '${prevPeriod.periodLabel}' and '${nextPeriod.periodLabel}' overlap by ${overlapHours} hours (${overlapMs}ms). Boundary must be partitioned.`,
      privacyGuarantee: privacyNote,
      overlapMs,
      error: `Boundary overlap of ${overlapMs}ms detected between Period A end and Period B start.`,
    };
  }

  // diffMs > 0: Gap
  const gapHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
  return {
    valid: false,
    relationship: "gap",
    boundaryTimestamp: null,
    periodAInterval: intervalA,
    periodBInterval: intervalB,
    intervalConvention: defaultConvention,
    boundaryResolution: `Transactions occurring between ${formatIso(endA)} and ${formatIso(startB)} fall outside both audit periods and will not be covered by either grant.`,
    summary: `A gap of ${gapHours} hours (${diffMs}ms) exists between periods '${prevPeriod.periodLabel}' and '${nextPeriod.periodLabel}'.`,
    privacyGuarantee: privacyNote,
    gapMs: diffMs,
    error: `Uncovered temporal gap of ${diffMs}ms detected between adjacent audit periods.`,
  };
}

/**
 * Resolves which adjacent period an event belongs to at boundary thresholds.
 */
export function resolveEventPeriod(
  eventTimestamp: string | Date,
  periodA: PayrollPeriodBoundary,
  periodB: PayrollPeriodBoundary
): {
  assignedPeriodId: string | null;
  isBoundaryCollision: boolean;
  explanation: string;
} {
  const eventDate = parseDate(eventTimestamp);
  const startA = parseDate(periodA.startUtc);
  const endA = parseDate(periodA.endUtc);
  const startB = parseDate(periodB.startUtc);
  const endB = parseDate(periodB.endUtc);

  if (!eventDate || !startA || !endA || !startB || !endB) {
    return {
      assignedPeriodId: null,
      isBoundaryCollision: false,
      explanation: "Unable to resolve period assignment due to invalid timestamp.",
    };
  }

  const t = eventDate.getTime();
  const tStartA = startA.getTime();
  const tEndA = endA.getTime();
  const tStartB = startB.getTime();
  const tEndB = endB.getTime();

  // Exactly at boundary
  if (tEndA === tStartB && t === tEndA) {
    return {
      assignedPeriodId: periodB.periodId,
      isBoundaryCollision: true,
      explanation: `Event occurs exactly at boundary ${formatIso(eventDate)}; assigned to succeeding period '${periodB.periodLabel}' under half-open convention [start, end).`,
    };
  }

  // Inside Period A: [startA, endA)
  if (t >= tStartA && t < tEndA) {
    return {
      assignedPeriodId: periodA.periodId,
      isBoundaryCollision: false,
      explanation: `Event falls within Period A '${periodA.periodLabel}'.`,
    };
  }

  // Inside Period B: [startB, endB)
  if (t >= tStartB && t < tEndB) {
    return {
      assignedPeriodId: periodB.periodId,
      isBoundaryCollision: false,
      explanation: `Event falls within Period B '${periodB.periodLabel}'.`,
    };
  }

  return {
    assignedPeriodId: null,
    isBoundaryCollision: false,
    explanation: `Event timestamp ${formatIso(eventDate)} falls outside both evaluated periods.`,
  };
}
