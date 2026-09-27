/**
 * Privacy guardrails for operational payroll-run notes.
 *
 * Notes are free-form handoff text, so they are the one place an operator can
 * casually paste a salary figure, an employee's name, or a wallet address. This
 * module is the single place that decides whether a note is safe to store, and
 * it is deliberately conservative: it reports *categories* of sensitive content
 * and never echoes the matched text back into a message, error, log, export,
 * telemetry event, or rendered UI.
 *
 * PRIVACY INVARIANT: every string returned by this module is a static constant
 * or a caller-supplied identifier (run id / note id). A finding can tell an
 * admin *that* a note mentions a compensation amount, never *what* it says.
 */

import type { UserRole } from "@/types";

/** Categories of content that must never be stored in a payroll-run note. */
export type RunNoteSensitiveCategory =
  | "compensation"
  | "employee_identity"
  | "credential";

/** One category of unsafe content detected in a note. */
export interface RunNoteSensitiveFinding {
  category: RunNoteSensitiveCategory;
  /** Short static label, safe to render and to log. */
  label: string;
  /** Static, actionable guidance. Never contains the matched value. */
  guidance: string;
}

/** Roster values a note must not quote. */
export interface RunNoteEmployeeContext {
  id?: string;
  name?: string;
  email?: string;
  address?: string;
}

export interface RunNoteScanContext {
  /**
   * Roster entries the note may not name. Names, emails, ids and wallet
   * addresses are all matched case-insensitively on word boundaries.
   */
  employees?: RunNoteEmployeeContext[];
}

/** Copy shown next to the note editor. */
export const RUN_NOTE_PRIVACY_NOTICE =
  "Notes are stored in this session only. Do not include salary amounts, employee names or contact details, wallet addresses, or credentials.";

const CATEGORY_LABELS: Record<RunNoteSensitiveCategory, string> = {
  compensation: "Salary or payment amount",
  employee_identity: "Employee personal data",
  credential: "Credential or secret",
};

const CATEGORY_GUIDANCE: Record<RunNoteSensitiveCategory, string> = {
  compensation:
    "Remove the figure. Refer to the amount as \"above threshold\", \"below threshold\", or \"matches the approved amount\" — the payroll record already holds the value.",
  employee_identity:
    "Remove the personal data. Refer to the employee by employee reference or by the draft entry position, not by name, email, or wallet address.",
  credential:
    "Remove the secret immediately and rotate it if it was real. Credentials must never be shared in a payroll note.",
};

/** Shown instead of a note body once a note has been rejected. */
export const REDACTED_RUN_NOTE_PLACEHOLDER = "[NOTE REJECTED — SENSITIVE CONTENT]";

/** Metadata only. Safe for audit trails, exports, logs, and telemetry. */
export interface RunNoteAuditEntry {
  runId: string;
  noteId: string;
  authorRole: UserRole;
  characterCount: number;
  createdAt: string;
}

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const WALLET_ADDRESS_PATTERN = /\bG[A-Z2-7]{20,}\b/;
const EMPLOYEE_ID_PATTERN = /\bemp[-_ ]?\d+\b/i;
const CURRENCY_AMOUNT_PATTERN = /[$€£¥₦]\s?\d/;
const GROUPED_AMOUNT_PATTERN = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/;
const ASSET_AMOUNT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:XLM|USDC|USDT|USD|EUR|GBP|BTC|ETH|NGN)\b/i;
const BARE_AMOUNT_PATTERN = /\b\d{4,}\b/;
/**
 * Compensation vocabulary. On its own a keyword is fine — "compensation
 * review" and "Q1 bonus run" are ordinary operational text — so a keyword only
 * counts as a finding when the note also carries a figure.
 */
const SALARY_KEYWORD_PATTERN =
  /\b(salary|salaries|wage|wages|pay\s?rate|hourly|per\s+hour|annual\s+pay|net\s+pay|gross\s+pay|compensation|remuneration|bonus\s+(?:amount|pool|payout)|payout\s+amount|stipend)\b/i;
const CREDENTIAL_PATTERN =
  /\b(private[\s_-]?key|secret[\s_-]?key|seed\s+phrase|mnemonic|recovery\s+phrase|password|passphrase|api\s+key|auth\s+token|bearer\s+token)\b/i;
const LONG_HEX_PATTERN = /\b0x[0-9a-fA-F]{40,}\b/;

/**
 * Numeric tokens that look like amounts but are really references: dates,
 * clock times, and compact `YYYYMMDD` batch identifiers. Replaced before the
 * amount scan so "reconciled against batch 20260925" is not read as a payout.
 */
const NON_AMOUNT_NUMERIC_PATTERN =
  /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:19|20)\d{6}\b|\b(?:19|20)\d{2}\b|\b\d{1,2}:\d{2}\b/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A name of fewer than four characters is too ambiguous to match safely
 * ("Jo", "Al"), so short roster names are ignored rather than guessed at.
 */
const MIN_MATCHABLE_NAME_LENGTH = 4;

function rosterPatterns(context: RunNoteScanContext): RegExp[] {
  const patterns: RegExp[] = [];
  const values = new Set<string>();

  for (const employee of context.employees ?? []) {
    for (const value of [employee.name, employee.email, employee.address, employee.id]) {
      const trimmed = value?.trim();
      if (trimmed) values.add(trimmed);
    }
  }

  for (const value of Array.from(values)) {
    if (value.length < MIN_MATCHABLE_NAME_LENGTH) continue;
    patterns.push(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, "iu"));
  }

  return patterns;
}

/** True when the note quotes a value that exists in the supplied roster. */
function quotesRosterValue(text: string, context: RunNoteScanContext): boolean {
  return rosterPatterns(context).some((pattern) => pattern.test(text));
}

/**
 * Salary and payment figures. Currency symbols, grouped amounts, asset-coded
 * amounts, and any bare four-or-more digit number are hard blocks. Compensation
 * keywords are only a finding when a figure sits next to them, so text such as
 * "compensation review" or "Q1 bonus run" stays writable. Date-shaped numbers
 * are removed first so "batch 20260925" is not read as a payout.
 */
function mentionsCompensationAmount(text: string): boolean {
  if (
    CURRENCY_AMOUNT_PATTERN.test(text) ||
    GROUPED_AMOUNT_PATTERN.test(text) ||
    ASSET_AMOUNT_PATTERN.test(text)
  ) {
    return true;
  }

  const withoutDates = text.replace(NON_AMOUNT_NUMERIC_PATTERN, " ");
  if (BARE_AMOUNT_PATTERN.test(withoutDates)) return true;

  return SALARY_KEYWORD_PATTERN.test(text) && /\d/.test(withoutDates);
}

function mentionsEmployeeIdentity(text: string, context: RunNoteScanContext): boolean {
  return (
    EMAIL_PATTERN.test(text) ||
    WALLET_ADDRESS_PATTERN.test(text) ||
    EMPLOYEE_ID_PATTERN.test(text) ||
    quotesRosterValue(text, context)
  );
}

function mentionsCredential(text: string): boolean {
  return CREDENTIAL_PATTERN.test(text) || LONG_HEX_PATTERN.test(text);
}

function toFinding(category: RunNoteSensitiveCategory): RunNoteSensitiveFinding {
  return {
    category,
    label: CATEGORY_LABELS[category],
    guidance: CATEGORY_GUIDANCE[category],
  };
}

/**
 * Scan note text and return every unsafe category found, in a stable order.
 * An empty array means the note is safe to store.
 */
export function scanRunNoteForSensitiveContent(
  text: string,
  context: RunNoteScanContext = {},
): RunNoteSensitiveFinding[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const findings: RunNoteSensitiveFinding[] = [];
  if (mentionsCompensationAmount(trimmed)) findings.push(toFinding("compensation"));
  if (mentionsEmployeeIdentity(trimmed, context)) findings.push(toFinding("employee_identity"));
  if (mentionsCredential(trimmed)) findings.push(toFinding("credential"));

  return findings;
}

/** Convenience predicate for callers that only need a yes/no answer. */
export function containsSensitiveRunNoteContent(
  text: string,
  context: RunNoteScanContext = {},
): boolean {
  return scanRunNoteForSensitiveContent(text, context).length > 0;
}

/**
 * Build the audit entry for a stored note. Carries metadata only — the note
 * body is deliberately absent so audit exports, activity feeds, and telemetry
 * can never surface note text.
 */
export function buildRunNoteAuditEntry(input: {
  runId: string;
  noteId: string;
  body: string;
  authorRole: UserRole;
  createdAt: string;
}): RunNoteAuditEntry {
  return {
    runId: input.runId,
    noteId: input.noteId,
    authorRole: input.authorRole,
    characterCount: input.body.trim().length,
    createdAt: input.createdAt,
  };
}
