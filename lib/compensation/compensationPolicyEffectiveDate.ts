import {
  COMPENSATION_POLICY_STATUSES,
  COMPENSATION_POLICY_STATUS_LABELS,
  type CompensationPolicyEffectiveDateCheck,
  type CompensationPolicyEffectiveDateOptions,
  type CompensationPolicyEffectiveDateResult,
  type CompensationPolicyEffectiveDateStatus,
  type CompensationPolicyScheduleEntry,
  type CompensationPolicyStatus,
} from "@/types/compensation";

/**
 * Compensation policy effective-date validation.
 *
 * A compensation policy revision is only useful to payroll if its effective date
 * is unambiguous, real, and moves strictly forward through time. This module is
 * the single place those rules live, so the dashboard, the policy editor, and
 * any future scheduling path all agree on what a usable effective date is.
 *
 * Rules enforced:
 *  1. Every revision needs a bounded, non-empty identifier.
 *  2. Every revision needs an `effectiveDate` in strict `YYYY-MM-DD` form naming
 *     a real calendar day (rejects `2026-02-30` and friends).
 *  3. Every revision needs a known lifecycle `status`.
 *  4. Pending revisions (`draft`, `scheduled`) may not be backdated:
 *     retroactive compensation changes would rewrite payroll runs that are
 *     already committed on-chain. An `active` or `superseded` revision
 *     necessarily took effect in the past, so it is exempt.
 *  5. At most one revision may be `active`; an ambiguous "current" policy means
 *     payroll cannot tell which policy governs an open period.
 *  6. No two revisions may share an effective date.
 *  7. Draft and scheduled revisions may not take effect before the active
 *     revision, which would create overlapping policy windows.
 *  8. Revisions beyond the scheduling horizon are flagged as a warning, since
 *     the payroll engine cannot plan that far ahead.
 *
 * PRIVACY: evaluation reads only policy ids, lifecycle statuses, and calendar
 * dates. Salary amounts, employee identities, and payout destinations are not
 * part of {@link CompensationPolicyScheduleEntry} and are never read, derived,
 * or echoed into findings. Findings interpolate only validated date strings and
 * bounded policy ids, so a message can never carry a compensation value.
 *
 * All functions here are pure: they never throw on untrusted policy input,
 * mutate their arguments, or read the clock (pass `referenceDate` instead).
 */

/**
 * Thrown when a compensation policy schedule is scheduled while its effective
 * dates are invalid.
 */
export class CompensationPolicyEffectiveDateError extends Error {
  public readonly result: CompensationPolicyEffectiveDateResult;

  constructor(message: string, result: CompensationPolicyEffectiveDateResult) {
    super(message);
    this.name = "CompensationPolicyEffectiveDateError";
    this.result = result;
  }
}

/**
 * How far ahead of the reference date a compensation revision may be scheduled,
 * in whole days. Beyond this the payroll engine cannot guarantee the revision
 * will be honoured, so it is surfaced as a warning rather than silently ignored.
 */
export const DEFAULT_COMPENSATION_HORIZON_DAYS = 400;

/** Maximum accepted length of a policy revision id, so findings stay bounded. */
export const MAX_COMPENSATION_POLICY_ID_LENGTH = 64;

/** Default remediation link surfaced with an actionable result. */
export const DEFAULT_COMPENSATION_REMEDIATION_ACTION: {
  label: string;
  href: string;
} = {
  label: "Review compensation policy schedule",
  href: "/settings/payroll-policy",
};

const ISO_CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * Number of days in the given 1-based UTC month, leap years included.
 *
 * `setUTCFullYear` is used instead of relying on `Date.UTC` alone so that years
 * below 100 (where `Date.UTC` remaps to 1900+) are still measured against the
 * correct leap-year rule.
 */
function daysInUtcMonth(year: number, month: number): number {
  const firstOfNextMonth = new Date(Date.UTC(2000, month, 1));
  firstOfNextMonth.setUTCFullYear(year);
  return new Date(
    Date.UTC(
      firstOfNextMonth.getUTCFullYear(),
      firstOfNextMonth.getUTCMonth(),
      0,
    ),
  ).getUTCDate();
}

/** UTC midnight for a 1-based month/day, correct for years below 100 too. */
function toUtcMidnight(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/** Parse a strict `YYYY-MM-DD` real calendar date, or return `null`. */
function parseCalendarDate(value: string): number | null {
  const match = ISO_CALENDAR_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInUtcMonth(year, month)) return null;

  return toUtcMidnight(year, month, day);
}

/** Format an epoch timestamp as a `YYYY-MM-DD` UTC calendar date. */
function toIsoCalendarDate(epochMs: number): string {
  const date = new Date(epochMs);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Whole days from `from` to `to`, negative when `to` is earlier. */
function daysBetween(from: number, to: number): number {
  return Math.round((to - from) / MS_PER_DAY);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * True when `value` is a string naming a real calendar day in `YYYY-MM-DD`
 * form. Rejects blank strings, other formats, and impossible days such as
 * `2026-02-30` or `2026-13-01`, which `Date.parse` would silently roll forward.
 */
export function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return parseCalendarDate(value) !== null;
}

/**
 * Resolve the reference date used for past-date and horizon comparisons.
 *
 * Accepts an ISO calendar date, an ISO timestamp, a `Date`, or epoch
 * milliseconds; `undefined`/`null` means today (UTC). Throws `RangeError` for a
 * developer-supplied value that cannot be resolved, because an unusable
 * reference date would silently invert every comparison rather than surface a
 * real payroll problem.
 */
export function normalizeReferenceDate(
  value?: string | Date | number | null,
): string {
  if (value === undefined || value === null) {
    return toIsoCalendarDate(Date.now());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      throw new RangeError("Reference date cannot be an empty string.");
    }

    const calendarDate = parseCalendarDate(trimmed);
    if (calendarDate !== null) return toIsoCalendarDate(calendarDate);

    // A `YYYY-MM-DD` string that is not a real calendar day is a typo, not a
    // timestamp. `Date.parse` would silently roll `2026-02-30` forward to March
    // 2 and quietly shift every comparison, so reject it instead.
    if (ISO_CALENDAR_DATE_PATTERN.test(trimmed)) {
      throw new RangeError(
        `Reference date "${trimmed}" is not a real calendar day.`,
      );
    }

    const timestamp = Date.parse(trimmed);
    if (Number.isNaN(timestamp)) {
      throw new RangeError(
        `Reference date "${trimmed}" is not a valid ISO calendar date or timestamp.`,
      );
    }
    return toIsoCalendarDate(timestamp);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new RangeError("Reference date is an invalid Date instance.");
    }
    return toIsoCalendarDate(value.getTime());
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError("Reference date must be a finite epoch timestamp.");
    }
    return toIsoCalendarDate(value);
  }

  throw new RangeError(
    "Reference date must be a string, Date, or epoch milliseconds.",
  );
}

/** Narrow an unknown value to a known compensation policy lifecycle status. */
export function isCompensationPolicyStatus(
  value: unknown,
): value is CompensationPolicyStatus {
  return (
    typeof value === "string" &&
    (COMPENSATION_POLICY_STATUSES as readonly string[]).includes(value)
  );
}

/** Normalize a policy revision id, or return `null` when unusable. */
function normalizePolicyId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_COMPENSATION_POLICY_ID_LENGTH) {
    return null;
  }
  return trimmed;
}

/** A revision that passed the per-entry shape checks, with its parsed date. */
interface ResolvedPolicy {
  id: string;
  effectiveDate: string;
  effectiveDateMs: number;
  status: CompensationPolicyStatus;
  /** Rule ids that produced a blocking finding for this revision. */
  errorIds: string[];
}

function resolveHorizon(maxHorizonDays: unknown): {
  maxHorizonDays: number;
  issue: CompensationPolicyEffectiveDateCheck | null;
} {
  if (maxHorizonDays === undefined || maxHorizonDays === null) {
    return { maxHorizonDays: DEFAULT_COMPENSATION_HORIZON_DAYS, issue: null };
  }

  if (
    typeof maxHorizonDays === "number" &&
    Number.isInteger(maxHorizonDays) &&
    maxHorizonDays > 0
  ) {
    return { maxHorizonDays, issue: null };
  }

  return {
    maxHorizonDays: DEFAULT_COMPENSATION_HORIZON_DAYS,
    issue: {
      id: "invalid-scheduling-horizon",
      severity: "warning",
      title: "Invalid scheduling horizon",
      message: `The scheduling horizon must be a positive whole number of days; the default of ${pluralize(DEFAULT_COMPENSATION_HORIZON_DAYS, "day")} was used instead.`,
      remediation: "Pass maxHorizonDays as a positive whole number of days.",
    },
  };
}

function describeIds(ids: readonly (string | undefined)[]): string {
  return ids
    .map((id) => (id === undefined ? "(unreadable id)" : id))
    .join(", ");
}

/**
 * Evaluate the effective dates of a compensation policy schedule.
 *
 * Never throws on untrusted policy input: malformed revisions are reported as
 * findings and skipped, so one bad row cannot hide the rest of the schedule.
 * The only thrown error comes from a developer-supplied `referenceDate` that
 * cannot be resolved (see {@link normalizeReferenceDate}).
 */
export function evaluateCompensationPolicyEffectiveDate(
  policies: unknown,
  options: CompensationPolicyEffectiveDateOptions = {},
): CompensationPolicyEffectiveDateResult {
  const remediationAction = options.remediationAction ?? {
    ...DEFAULT_COMPENSATION_REMEDIATION_ACTION,
  };
  const referenceDate = normalizeReferenceDate(options.referenceDate);
  const referenceMs = parseCalendarDate(referenceDate) as number;
  const { maxHorizonDays, issue: horizonIssue } = resolveHorizon(
    options.maxHorizonDays,
  );

  const errors: CompensationPolicyEffectiveDateCheck[] = [];
  const warnings: CompensationPolicyEffectiveDateCheck[] = [];
  if (horizonIssue) warnings.push(horizonIssue);

  /** Revisions that cleared the per-entry shape checks, in input order. */
  const resolvedPolicies: ResolvedPolicy[] = [];

  const addError = (
    policy: ResolvedPolicy,
    check: CompensationPolicyEffectiveDateCheck,
  ): void => {
    errors.push(check);
    policy.errorIds.push(check.id);
  };

  const addWarning = (check: CompensationPolicyEffectiveDateCheck): void => {
    warnings.push(check);
  };

  if (!Array.isArray(policies)) {
    errors.push({
      id: "policies-not-a-list",
      severity: "error",
      title: "Unreadable compensation policy schedule",
      message:
        "Compensation policy effective dates could not be checked because the schedule is not a list of policy revisions.",
      remediation: `Pass the scheduled compensation policy revisions, or review them at ${remediationAction.href}.`,
    });
  } else if (policies.length === 0) {
    errors.push({
      id: "no-policies-scheduled",
      severity: "error",
      title: "No compensation policy scheduled",
      message:
        "Compensation policy effective dates cannot be verified because no compensation policy revisions are scheduled.",
      remediation: `Schedule a compensation policy with a future effective date at ${remediationAction.href}.`,
    });
  } else {
    policies.forEach((rawEntry, index) => resolveEntry(rawEntry, index));
  }

  applyPastDateRule();
  applySingleActiveRule();
  applyDuplicateDateRule();
  applyWindowOverlapRule();
  applyHorizonRule();

  const validPolicyCount = resolvedPolicies.filter(
    (policy) => policy.errorIds.length === 0,
  ).length;
  const status: CompensationPolicyEffectiveDateStatus =
    errors.length > 0 ? "invalid" : warnings.length > 0 ? "warning" : "valid";

  const nextUpcoming = resolvedPolicies
    .filter(
      (policy) =>
        policy.status !== "superseded" && policy.effectiveDateMs >= referenceMs,
    )
    .sort((a, b) => a.effectiveDateMs - b.effectiveDateMs)[0];

  return {
    status,
    canScheduleCompensationChanges: errors.length === 0,
    checkedPolicies: resolvedPolicies.map((policy) => ({
      id: policy.id,
      effectiveDate: policy.effectiveDate,
      status: policy.status,
    })),
    checks: [...errors, ...warnings],
    errors,
    warnings,
    validPolicyCount,
    nextEffectiveDate: nextUpcoming ? nextUpcoming.effectiveDate : null,
    daysUntilNextEffectiveDate: nextUpcoming
      ? daysBetween(referenceMs, nextUpcoming.effectiveDateMs)
      : null,
    summaryMessage: buildSummaryMessage({
      status,
      totalPolicies: Array.isArray(policies) ? policies.length : 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      nextEffectiveDate: nextUpcoming ? nextUpcoming.effectiveDate : null,
      daysUntilNext: nextUpcoming
        ? daysBetween(referenceMs, nextUpcoming.effectiveDateMs)
        : null,
      remediationHref: remediationAction.href,
    }),
    remediationAction:
      status === "valid" ? undefined : { ...remediationAction },
  };

  function resolveEntry(rawEntry: unknown, index: number): void {
    const position = index + 1;
    /** Findings for this entry, attached to the revision once it resolves. */
    const entryErrors: CompensationPolicyEffectiveDateCheck[] = [];

    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      entryErrors.push({
        id: "policy-entry-invalid",
        severity: "error",
        title: "Unreadable policy revision",
        message: `The compensation policy revision at position ${position} is not a policy record and was ignored.`,
        remediation:
          "Remove the unreadable entry or correct its shape, then reload the schedule.",
      });
      errors.push(...entryErrors);
      return;
    }

    const entry = rawEntry as Partial<CompensationPolicyScheduleEntry>;
    const id = normalizePolicyId(entry.id);
    const subject = id ?? `the revision at position ${position}`;

    if (!id) {
      entryErrors.push({
        id: "policy-id-invalid",
        severity: "error",
        title: "Missing policy identifier",
        message: `The compensation policy revision at position ${position} has a missing or unusable identifier, so its effective date cannot be tracked.`,
        remediation: `Give the revision an identifier of 1 to ${MAX_COMPENSATION_POLICY_ID_LENGTH} characters.`,
      });
    }

    const rawEffectiveDate = entry.effectiveDate;
    let effectiveDateMs: number | null = null;

    if (
      typeof rawEffectiveDate !== "string" ||
      rawEffectiveDate.trim() === ""
    ) {
      entryErrors.push({
        id: "effective-date-missing",
        policyId: id ?? undefined,
        severity: "error",
        title: "Effective date is required",
        message: `Compensation policy ${subject} has no effective date, so payroll cannot tell when its terms take effect.`,
        remediation: "Set an effective date in YYYY-MM-DD format.",
      });
    } else if (!isIsoCalendarDate(rawEffectiveDate)) {
      entryErrors.push({
        id: "effective-date-malformed",
        policyId: id ?? undefined,
        severity: "error",
        title: "Unusable effective date",
        message: `Compensation policy ${subject} has an effective date that is not a real calendar day in YYYY-MM-DD format.`,
        remediation:
          "Use a YYYY-MM-DD date that exists on the calendar, for example 2026-10-01.",
      });
    } else {
      effectiveDateMs = parseCalendarDate(rawEffectiveDate);
    }

    const rawStatus = entry.status;
    if (!isCompensationPolicyStatus(rawStatus)) {
      entryErrors.push({
        id: "policy-status-invalid",
        policyId: id ?? undefined,
        severity: "error",
        title: "Unknown policy status",
        message: `Compensation policy ${subject} has a missing or unknown lifecycle status, so its effective date cannot be ordered against other policies.`,
        remediation: `Use one of: ${COMPENSATION_POLICY_STATUSES.join(", ")}.`,
      });
    }

    if (id && effectiveDateMs !== null && isCompensationPolicyStatus(rawStatus)) {
      resolvedPolicies.push({
        id,
        effectiveDate: toIsoCalendarDate(effectiveDateMs),
        effectiveDateMs,
        status: rawStatus,
        errorIds: entryErrors.map((check) => check.id),
      });
    }

    errors.push(...entryErrors);
  }

  function applyPastDateRule(): void {
    resolvedPolicies.forEach((policy) => {
      // An `active` or `superseded` revision took effect in the past by design;
      // only revisions that are still pending may not be backdated.
      if (policy.status === "active" || policy.status === "superseded") return;

      const daysFromNow = daysBetween(referenceMs, policy.effectiveDateMs);
      if (daysFromNow >= 0) return;

      addError(policy, {
        id: "effective-date-in-past",
        policyId: policy.id,
        severity: "error",
        title: "Effective date in the past",
        message: `Compensation policy ${policy.id} takes effect on ${policy.effectiveDate}, ${pluralize(Math.abs(daysFromNow), "day")} before the reference date ${referenceDate}. A pending compensation change cannot be backdated, because it would rewrite payroll runs that are already committed.`,
        remediation: `Move the effective date to ${referenceDate} or later, or supersede the policy with a correctly dated revision.`,
      });
    });
  }

  function applySingleActiveRule(): void {
    const active = resolvedPolicies.filter(
      (policy) => policy.status === "active",
    );
    if (active.length < 2) return;

    for (const policy of active) {
      addError(policy, {
        id: "multiple-active-policies",
        policyId: policy.id,
        severity: "error",
        title: "Multiple active compensation policies",
        message: `More than one compensation policy is marked active (${describeIds(active.map((entry) => entry.id))}), so payroll cannot determine which policy applies to an open period.`,
        remediation:
          "Keep exactly one active compensation policy and mark the remainder scheduled or superseded.",
      });
    }
  }

  function applyDuplicateDateRule(): void {
    const byDate = new Map<string, ResolvedPolicy[]>();
    resolvedPolicies.forEach((policy) => {
      const existing = byDate.get(policy.effectiveDate) ?? [];
      existing.push(policy);
      byDate.set(policy.effectiveDate, existing);
    });

    Array.from(byDate.entries()).forEach(([effectiveDate, group]) => {
      if (group.length < 2) return;

      const groupIds = group.map((entry: ResolvedPolicy) => entry.id);
      group.forEach((policy: ResolvedPolicy) => {
        addError(policy, {
          id: "effective-date-duplicate",
          policyId: policy.id,
          severity: "error",
          title: "Duplicate effective date",
          message: `${pluralize(group.length, "compensation policy", "compensation policies")} share the effective date ${effectiveDate} (${describeIds(groupIds)}), so the policy in force for that day is ambiguous.`,
          remediation:
            "Give each policy its own effective date, staggered at least one day apart.",
        });
      });
    });
  }

  function applyWindowOverlapRule(): void {
    const active = resolvedPolicies.filter(
      (policy) => policy.status === "active",
    );
    if (active.length !== 1) return;

    const currentPolicy = active[0];
    for (const policy of resolvedPolicies) {
      if (policy === currentPolicy) continue;
      if (policy.status === "superseded") continue;
      if (policy.effectiveDateMs >= currentPolicy.effectiveDateMs) continue;

      addError(policy, {
        id: "effective-date-before-active",
        policyId: policy.id,
        severity: "error",
        title: "Overlapping policy window",
        message: `Compensation policy ${policy.id} (${COMPENSATION_POLICY_STATUS_LABELS[policy.status]}) takes effect on ${policy.effectiveDate}, before the active policy ${currentPolicy.id} (${currentPolicy.effectiveDate}), which would create overlapping policy windows.`,
        remediation: `Set the effective date to ${currentPolicy.effectiveDate} or later so policy windows do not overlap.`,
      });
    }
  }

  function applyHorizonRule(): void {
    resolvedPolicies.forEach((policy) => {
      // A `superseded` revision is already history; there is nothing left to
      // schedule, so the horizon advisory would only add noise.
      if (policy.status === "superseded") return;

      const daysFromNow = daysBetween(referenceMs, policy.effectiveDateMs);
      if (daysFromNow <= maxHorizonDays) return;

      addWarning({
        id: "effective-date-beyond-horizon",
        policyId: policy.id,
        severity: "warning",
        title: "Effective date beyond scheduling horizon",
        message: `Compensation policy ${policy.id} takes effect on ${policy.effectiveDate}, ${pluralize(daysFromNow, "day")} after the reference date ${referenceDate}. That is beyond the ${maxHorizonDays}-day scheduling horizon, so payroll cannot guarantee the change will be honoured.`,
        remediation: `Move the effective date within ${maxHorizonDays} days of ${referenceDate}, or re-confirm the policy closer to its effective date.`,
      });
    });
  }
}

function buildSummaryMessage(context: {
  status: CompensationPolicyEffectiveDateStatus;
  totalPolicies: number;
  errorCount: number;
  warningCount: number;
  nextEffectiveDate: string | null;
  daysUntilNext: number | null;
  remediationHref: string;
}): string {
  const { status, totalPolicies, errorCount, warningCount } = context;
  const policyLabel = pluralize(totalPolicies, "policy", "policies");

  const upcoming =
    context.nextEffectiveDate === null || context.daysUntilNext === null
      ? "No future compensation change is scheduled."
      : context.daysUntilNext === 0
        ? `The next compensation change takes effect today (${context.nextEffectiveDate}).`
        : `The next compensation change takes effect on ${context.nextEffectiveDate}, in ${pluralize(context.daysUntilNext, "day")}.`;

  if (status === "invalid") {
    return `Compensation changes cannot be scheduled: ${pluralize(errorCount, "effective-date problem")} found across ${policyLabel}. ${upcoming} Review the schedule at ${context.remediationHref}.`;
  }

  if (status === "warning") {
    return `Compensation changes can be scheduled, but ${pluralize(warningCount, "advisory", "advisories")} need review across ${policyLabel}. ${upcoming}`;
  }

  return `All ${policyLabel} have a valid effective date. ${upcoming}`;
}

/**
 * Assert that a compensation policy schedule is safe to schedule.
 *
 * Throws {@link CompensationPolicyEffectiveDateError} when any blocking
 * effective-date finding is present. The thrown error carries the full result so
 * callers can render every finding rather than only the first.
 */
export function assertCompensationPolicyEffectiveDate(
  policies: unknown,
  options: CompensationPolicyEffectiveDateOptions = {},
): void {
  const result = evaluateCompensationPolicyEffectiveDate(policies, options);
  if (!result.canScheduleCompensationChanges) {
    throw new CompensationPolicyEffectiveDateError(
      result.summaryMessage,
      result,
    );
  }
}
