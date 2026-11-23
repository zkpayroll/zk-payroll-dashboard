export type ErrorCategory = "treasury" | "authorization" | "proof" | "conflict" | "network" | "unknown";

export type ErrorAudience = "contributor" | "maintainer" | "admin" | "auditor";

export interface RemediationAction {
  label: string;
  description: string;
  audience: ErrorAudience;
  href?: string;
}

export interface ErrorRemediation {
  id: string;
  category: ErrorCategory;
  title: string;
  summary: string;
  likelyCause: string;
  actions: RemediationAction[];
  docsHref?: string;
}

export interface ErrorRemediationDrawerState {
  isOpen: boolean;
  remediation: ErrorRemediation | null;
  openRemediation: (remediation: ErrorRemediation) => void;
  closeRemediation: () => void;
}

/**
 * Sensitivity level of a single error context field. Fields marked more
 * sensitive than the requesting audience are redacted or masked before the
 * context is surfaced to the dashboard or logs.
 */
export type ErrorContextSensitivity = "public" | "contributor" | "maintainer" | "auditor";

/**
 * A single field-level redaction rule used when filtering error context.
 * Fields not covered by a rule are treated as public by default.
 */
export interface ErrorContextFieldRule {
  /** Dot-path into the error context object, e.g. "payload.salary". */
  field: string;
  sensitivity: ErrorContextSensitivity;
  /** When true the value is masked rather than dropped entirely. */
  mask?: boolean;
}

/**
 * Options accepted by the privacy-safe error context filter.
 */
export interface PrivacySafeErrorContextOptions {
  /** Audience that will receive the filtered context. */
  audience: ErrorAudience;
  /** Additional field-level sensitivity rules. */
  rules?: ErrorContextFieldRule[];
}

/**
 * Result of filtering an error context for privacy-safe consumption.
 */
export interface PrivacySafeErrorContextResult {
  /** Context with sensitive fields removed or masked for the audience. */
  filtered: Record<string, unknown>;
  /** Field paths that were redacted or masked. */
  redactedFields: string[];
  /** Field paths that were retained unchanged. */
  retainedFields: string[];
  /** Whether the original context contained no sensitive fields for the audience. */
  isPrivacySafe: boolean;
  audience: ErrorAudience;
}
