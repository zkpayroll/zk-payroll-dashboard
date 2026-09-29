/**
 * Types for Dashboard Compensation Policy Effective-Date Validation.
 *
 * Privacy-safe domain contracts describing when a compensation policy revision
 * takes effect and whether the organization may schedule further compensation
 * changes.
 *
 * PRIVACY: a compensation policy revision is represented here by nothing more
 * than an internal policy id, a lifecycle status, and the calendar date it takes
 * effect. Salary amounts, employee identities, and payout destinations are
 * deliberately absent, so consumers of this module are structurally unable to
 * leak compensation values.
 */

/**
 * Lifecycle status of a single compensation policy revision.
 *
 * - `draft`      – proposed revision, not yet committed to the schedule.
 * - `scheduled`  – approved revision with a future effective date.
 * - `active`     – the revision currently in force (at most one allowed).
 * - `superseded` – historical revision kept only for audit purposes.
 */
export type CompensationPolicyStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "superseded";

/** Lifecycle statuses in declaration order, for exhaustiveness checks. */
export const COMPENSATION_POLICY_STATUSES: readonly CompensationPolicyStatus[] =
  ["draft", "scheduled", "active", "superseded"] as const;

/** Human-readable label for a compensation policy lifecycle status. */
export const COMPENSATION_POLICY_STATUS_LABELS: Record<
  CompensationPolicyStatus,
  string
> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  superseded: "Superseded",
};

/**
 * Overall effective-date health of a set of compensation policy revisions.
 *
 * - `valid`   – every revision has a forward-only, correctly ordered date.
 * - `warning` – dates are usable but one revision sits outside the scheduling
 *               horizon or another non-blocking concern was detected.
 * - `invalid` – at least one revision cannot be scheduled as declared.
 */
export type CompensationPolicyEffectiveDateStatus =
  | "valid"
  | "warning"
  | "invalid";

/** Severity of a single effective-date finding. */
export type CompensationPolicyEffectiveDateSeverity = "error" | "warning";

/**
 * A compensation policy revision reduced to its effective-date facts.
 *
 * Intentionally minimal: this is the only compensation policy shape accepted by
 * the validation rules.
 */
export interface CompensationPolicyScheduleEntry {
  /** Internal policy revision id, e.g. "comp_policy_2031". */
  id: string;
  /** ISO calendar date (YYYY-MM-DD) the revision takes effect. */
  effectiveDate: string;
  /** Lifecycle status of the revision. */
  status: CompensationPolicyStatus;
}

/** A single actionable effective-date finding. */
export interface CompensationPolicyEffectiveDateCheck {
  /** Stable machine-readable identifier for the rule that produced the finding. */
  id: string;
  /** Policy revision the finding is attributed to, when attributable. */
  policyId?: string;
  severity: CompensationPolicyEffectiveDateSeverity;
  /** Short rule name, e.g. "Effective date in the past". */
  title: string;
  /** Operator-facing explanation. Never contains amounts or identities. */
  message: string;
  /** Concrete next step that resolves the finding. */
  remediation?: string;
}

/** Options accepted by the effective-date evaluation. */
export interface CompensationPolicyEffectiveDateOptions {
  /**
   * Reference calendar date used for past-date and horizon comparisons.
   * Accepts an ISO calendar date, an ISO timestamp, a `Date`, or epoch
   * milliseconds. Defaults to today (UTC).
   */
  referenceDate?: string | Date | number | null;
  /**
   * Maximum number of days ahead of the reference date a revision may be
   * scheduled. Defaults to {@link DEFAULT_COMPENSATION_HORIZON_DAYS}.
   */
  maxHorizonDays?: number;
  /** Remediation link surfaced with the result when action is required. */
  remediationAction?: { label: string; href: string };
}

/** Result of evaluating the effective dates of a compensation policy schedule. */
export interface CompensationPolicyEffectiveDateResult {
  /** Overall effective-date health. */
  status: CompensationPolicyEffectiveDateStatus;
  /** Whether further compensation changes may be scheduled as declared. */
  canScheduleCompensationChanges: boolean;
  /** Revisions whose effective date parsed successfully, in input order. */
  checkedPolicies: CompensationPolicyScheduleEntry[];
  /** Every finding, errors first, then warnings. */
  checks: CompensationPolicyEffectiveDateCheck[];
  /** Blocking findings; non-empty when `status` is `invalid`. */
  errors: CompensationPolicyEffectiveDateCheck[];
  /** Non-blocking advisory findings. */
  warnings: CompensationPolicyEffectiveDateCheck[];
  /** Revisions that carry no blocking finding. */
  validPolicyCount: number;
  /** Earliest future effective date (ISO) among non-superseded revisions. */
  nextEffectiveDate: string | null;
  /** Whole days from the reference date to `nextEffectiveDate`. */
  daysUntilNextEffectiveDate: number | null;
  /** Single operator-facing summary of the result. */
  summaryMessage: string;
  /** Recommended remediation action, present when action is required. */
  remediationAction?: { label: string; href: string };
}
