/**
 * Auditor read-only view of archived payroll periods (#858).
 *
 * Auditors need to inspect payroll periods after they have been archived out
 * of the operational dashboards, without ever seeing private salary or
 * employee data and without any mutation capability.
 *
 * This module is pure: it takes the session outcome (as resolved from
 * `GET /api/auth/session`) and the archived runs, and returns either a
 * redacted, period-grouped view or an actionable, privacy-safe refusal.
 *
 * Privacy contract:
 *   - `totalAmount`, `employeeCount`, `notes`, `disputeReason` and
 *     `archivedBy` never leave this module. They are not copied onto the
 *     view model at all (not masked, omitted), so a render bug cannot leak
 *     them.
 *   - Transaction hashes are public on-chain data but are shortened to a
 *     preview so the view never becomes a raw ledger dump.
 *   - Refusal messages are static copy plus, at most, the requested period
 *     label after it passed format validation. They never say whether a
 *     non-archived (e.g. disputed) run exists for that period.
 */
import type { ArchivedPayrollRun, ArchivedRunStatus, AuditAvailability } from "@/stores/archive";
import type { UserRole } from "@/types";

export const AUDITOR_ARCHIVED_PERIODS_PATH = "/audit/archived-periods";

/** Fields of `ArchivedPayrollRun` that are withheld from auditors. */
export const AUDITOR_WITHHELD_RUN_FIELDS = [
  "totalAmount",
  "employeeCount",
  "notes",
  "disputeReason",
  "archivedBy",
] as const satisfies ReadonlyArray<keyof ArchivedPayrollRun>;

export type AuditorWithheldRunField = (typeof AUDITOR_WITHHELD_RUN_FIELDS)[number];

const PAY_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Session outcome as resolved from `GET /api/auth/session`. */
export type AuditorSessionState =
  | { status: "ready"; role: UserRole }
  /** 401 / unknown role: the session is missing or no longer valid. */
  | { status: "unavailable" }
  /** 5xx / network failure: the session service could not answer. */
  | { status: "error" };

export interface AuditorArchivedRunView {
  id: string;
  payrollRunId: string;
  employerId: string;
  employerName: string;
  payPeriod: string;
  asset: string;
  status: ArchivedRunStatus;
  auditAvailability: AuditAvailability;
  executedAt: string;
  archivedAt: string | null;
  transactionHashPreview: string;
  bundleId: string | null;
  receiptId: string | null;
  isDisputed: boolean;
  settlementPending: boolean;
}

export type AuditorPeriodAuditCoverage = "available" | "partial" | "unavailable";

export interface AuditorArchivedPeriod {
  payPeriod: string;
  runCount: number;
  assets: string[];
  auditCoverage: AuditorPeriodAuditCoverage;
  runs: AuditorArchivedRunView[];
}

export type AuditorArchiveDeniedCode =
  | "SESSION_UNAVAILABLE"
  | "SESSION_CHECK_FAILED"
  | "ROLE_NOT_AUDITOR"
  | "INVALID_PERIOD"
  | "PERIOD_NOT_ARCHIVED";

export interface AuditorArchiveAction {
  label: string;
  /** Navigation target; absent when the action is an in-place retry. */
  href?: string;
  kind: "navigate" | "retry";
}

export type AuditorArchiveAccessResult =
  | {
      ok: true;
      readOnly: true;
      periods: AuditorArchivedPeriod[];
      /** Runs dropped because they were malformed (missing id or period). */
      skippedCount: number;
      withheldFields: readonly AuditorWithheldRunField[];
    }
  | {
      ok: false;
      code: AuditorArchiveDeniedCode;
      title: string;
      message: string;
      action: AuditorArchiveAction;
    };

export interface AuditorArchiveAccessInput {
  session: AuditorSessionState;
  runs: readonly ArchivedPayrollRun[];
  /** Optional `YYYY-MM` period to narrow the view to. */
  period?: string | null;
}

const SIGN_IN_HREF = `/login?redirect=${encodeURIComponent(AUDITOR_ARCHIVED_PERIODS_PATH)}`;

function deny(
  code: AuditorArchiveDeniedCode,
  title: string,
  message: string,
  action: AuditorArchiveAction,
): AuditorArchiveAccessResult {
  return { ok: false, code, title, message, action };
}

export function previewTransactionHash(hash: string): string {
  if (typeof hash !== "string" || hash.length === 0) return "—";
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/**
 * Build the auditor view model for one run. Only allow-listed fields are
 * copied, so new private fields added to `ArchivedPayrollRun` stay hidden by
 * default.
 */
export function toAuditorArchivedRunView(run: ArchivedPayrollRun): AuditorArchivedRunView {
  return {
    id: run.id,
    payrollRunId: run.payrollRunId,
    employerId: run.employerId,
    employerName: run.employerName,
    payPeriod: run.payPeriod,
    asset: run.asset,
    status: run.status,
    auditAvailability: run.auditAvailability,
    executedAt: run.executedAt,
    archivedAt: run.archivedAt ?? null,
    transactionHashPreview: previewTransactionHash(run.transactionHash),
    bundleId: run.bundleId ?? null,
    receiptId: run.receiptId ?? null,
    isDisputed: Boolean(run.isDisputed),
    settlementPending: Boolean(run.settlementPending),
  };
}

function isWellFormedArchivedRun(run: unknown): run is ArchivedPayrollRun {
  if (typeof run !== "object" || run === null) return false;
  const r = run as Partial<ArchivedPayrollRun>;
  return (
    typeof r.id === "string" &&
    r.id.length > 0 &&
    typeof r.payPeriod === "string" &&
    PAY_PERIOD_PATTERN.test(r.payPeriod)
  );
}

function coverageFor(runs: AuditorArchivedRunView[]): AuditorPeriodAuditCoverage {
  const available = runs.filter((r) => r.auditAvailability === "available").length;
  if (available === runs.length) return "available";
  if (available === 0 && runs.every((r) => r.auditAvailability === "unavailable")) {
    return "unavailable";
  }
  return "partial";
}

/** Group archived runs into periods, newest period first. */
export function groupArchivedPeriodsForAuditor(runs: readonly ArchivedPayrollRun[]): {
  periods: AuditorArchivedPeriod[];
  skippedCount: number;
} {
  const byPeriod = new Map<string, AuditorArchivedRunView[]>();
  let skippedCount = 0;

  for (const run of runs) {
    if (!isWellFormedArchivedRun(run)) {
      skippedCount += 1;
      continue;
    }
    // Only runs that were actually archived are in scope for auditors.
    if (run.isArchived !== true) continue;

    const view = toAuditorArchivedRunView(run);
    const bucket = byPeriod.get(view.payPeriod) ?? [];
    bucket.push(view);
    byPeriod.set(view.payPeriod, bucket);
  }

  const periods = Array.from(byPeriod.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([payPeriod, periodRuns]) => ({
      payPeriod,
      runCount: periodRuns.length,
      assets: Array.from(new Set(periodRuns.map((r) => r.asset))).sort(),
      auditCoverage: coverageFor(periodRuns),
      runs: [...periodRuns].sort((a, b) => a.id.localeCompare(b.id)),
    }));

  return { periods, skippedCount };
}

/**
 * Decide whether the current session may see archived payroll periods and,
 * if so, return the redacted read-only view.
 */
export function evaluateAuditorArchivedPeriodAccess(
  input: AuditorArchiveAccessInput,
): AuditorArchiveAccessResult {
  const { session, runs, period } = input;

  if (session.status === "error") {
    return deny(
      "SESSION_CHECK_FAILED",
      "Could not verify auditor access",
      "Loading archived periods failed: the session service did not respond. Retry the access check; no payroll data was loaded.",
      { label: "Retry access check", kind: "retry" },
    );
  }

  if (session.status === "unavailable") {
    return deny(
      "SESSION_UNAVAILABLE",
      "Sign in to view archived periods",
      "Loading archived periods failed: your session is missing or has expired. Sign in again with your auditor wallet to continue.",
      { label: "Sign in again", href: SIGN_IN_HREF, kind: "navigate" },
    );
  }

  if (session.role !== "auditor") {
    return deny(
      "ROLE_NOT_AUDITOR",
      "Auditor view only",
      "This read-only, redacted view is reserved for auditor sessions. Admins and operators can review archived runs in the Payroll Archive Center.",
      { label: "Open Payroll Archive Center", href: "/archive/payroll-runs", kind: "navigate" },
    );
  }

  const requested = typeof period === "string" ? period.trim() : "";
  if (requested && !PAY_PERIOD_PATTERN.test(requested)) {
    return deny(
      "INVALID_PERIOD",
      "Unrecognized payroll period",
      "Loading archived periods failed: the requested period is not in YYYY-MM format. Choose a period from the full archived list.",
      { label: "View all archived periods", href: AUDITOR_ARCHIVED_PERIODS_PATH, kind: "navigate" },
    );
  }

  const grouped = groupArchivedPeriodsForAuditor(Array.isArray(runs) ? runs : []);

  if (requested) {
    const match = grouped.periods.filter((p) => p.payPeriod === requested);
    if (match.length === 0) {
      return deny(
        "PERIOD_NOT_ARCHIVED",
        "No archived runs for this period",
        `No archived payroll runs are available for ${requested}. Periods appear here only after they are archived; choose another period from the full list.`,
        { label: "View all archived periods", href: AUDITOR_ARCHIVED_PERIODS_PATH, kind: "navigate" },
      );
    }
    return {
      ok: true,
      readOnly: true,
      periods: match,
      skippedCount: grouped.skippedCount,
      withheldFields: AUDITOR_WITHHELD_RUN_FIELDS,
    };
  }

  return {
    ok: true,
    readOnly: true,
    periods: grouped.periods,
    skippedCount: grouped.skippedCount,
    withheldFields: AUDITOR_WITHHELD_RUN_FIELDS,
  };
}
