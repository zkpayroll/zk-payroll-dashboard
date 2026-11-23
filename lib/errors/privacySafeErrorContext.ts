import type {
  ErrorAudience,
  ErrorContextFieldRule,
  ErrorContextSensitivity,
  PrivacySafeErrorContextOptions,
  PrivacySafeErrorContextResult,
} from "@/types/errors";

/**
 * Dashboard privacy-safe error context filtering (#685).
 *
 * Payroll errors may carry request payloads, employee identifiers, wallet
 * addresses, or salary values in their context. Before that context is logged,
 * surfaced in an error banner, or sent to telemetry it must be filtered so
 * fields above the requesting audience's sensitivity level are redacted or
 * masked. This module is the single place those rules live so the dashboard,
 * error drawer, and telemetry pipeline all agree on what is safe to show.
 *
 * Audience sensitivity ordering (least to most privileged):
 *  contributor < maintainer < auditor
 *
 * PRIVACY: evaluation never echoes raw salary amounts, wallet addresses, or
 * employee identities into redacted field lists — only the field path is
 * reported, never the value.
 *
 * All functions are pure: they never throw on untrusted context input, never
 * mutate their arguments, and never read the clock.
 */

const AUDIENCE_RANK: Record<ErrorAudience, number> = {
  contributor: 0,
  maintainer: 1,
  auditor: 2,
};

const DEFAULT_SENSITIVITY: ErrorContextSensitivity = "public";

/** Field names that are always treated as sensitive regardless of audience. */
const ALWAYS_SENSITIVE_FIELDS = new Set([
  "salary",
  "salaryCommitment",
  "address",
  "walletAddress",
  "payoutDestination",
  "employeeId",
  "name",
  "email",
]);

/**
 * Resolve the sensitivity of a single field path. Explicit rules win, then
 * always-sensitive field names, then the default public sensitivity.
 */
function fieldSensitivity(
  field: string,
  rules: readonly ErrorContextFieldRule[],
): ErrorContextSensitivity {
  const rule = rules.find((r) => r.field === field);
  if (rule) return rule.sensitivity;

  const leaf = field.split(".").pop() ?? field;
  if (ALWAYS_SENSITIVE_FIELDS.has(leaf)) return "auditor";

  return DEFAULT_SENSITIVITY;
}

/** Audience rank threshold — fields at or above this rank are filtered for the audience. */
function filterRank(audience: ErrorAudience): number {
  return AUDIENCE_RANK[audience];
}

/** Mask a scalar value while preserving its type shape. */
function maskValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > 0 ? "••••" : value;
  }
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return "[redacted]";
}

/**
 * Walk a nested object and apply field-level sensitivity filtering. Returns
 * the filtered copy plus the list of redacted and retained field paths.
 */
function filterObject(
  value: unknown,
  prefix: string,
  rules: readonly ErrorContextFieldRule[],
  audienceRank: number,
  redacted: string[],
  retained: string[],
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      filterObject(item, `${prefix}[${index}]`, rules, audienceRank, redacted, retained),
    );
  }

  if (typeof value === "object") {
    const entry = value as Record<string, unknown>;
    const filtered: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(entry)) {
      const path = prefix === "" ? key : `${prefix}.${key}`;
      const sensitivity = fieldSensitivity(path, rules);
      if (AUDIENCE_RANK[sensitivity] > audienceRank) {
        redacted.push(path);
        const rule = rules.find((r) => r.field === path);
        if (rule?.mask) {
          filtered[key] = maskValue(child);
        } else {
          filtered[key] = "[redacted]";
        }
      } else {
        retained.push(path);
        filtered[key] = filterObject(
          child,
          path,
          rules,
          audienceRank,
          redacted,
          retained,
        );
      }
    }
    return filtered;
  }

  return value;
}

/**
 * Filter an error context so that fields above the requesting audience's
 * sensitivity level are redacted or masked. Never throws on untrusted input:
 * non-object contexts are returned unchanged.
 */
export function filterErrorContext(
  context: unknown,
  options: PrivacySafeErrorContextOptions,
): PrivacySafeErrorContextResult {
  const audienceRank = filterRank(options.audience);
  const rules = options.rules ?? [];
  const redacted: string[] = [];
  const retained: string[] = [];

  const filtered = filterObject(
    context,
    "",
    rules,
    audienceRank,
    redacted,
    retained,
  );

  return {
    filtered:
      typeof filtered === "object" && filtered !== null && !Array.isArray(filtered)
        ? (filtered as Record<string, unknown>)
        : {},
    redactedFields: redacted,
    retainedFields: retained,
    isPrivacySafe: redacted.length === 0,
    audience: options.audience,
  };
}

/** Default field rules covering the common payroll error context payload. */
export const DEFAULT_ERROR_CONTEXT_RULES: ErrorContextFieldRule[] = [
  { field: "salary", sensitivity: "auditor" },
  { field: "salaryCommitment", sensitivity: "auditor", mask: true },
  { field: "address", sensitivity: "auditor", mask: true },
  { field: "walletAddress", sensitivity: "auditor", mask: true },
  { field: "payoutDestination", sensitivity: "auditor", mask: true },
  { field: "employeeId", sensitivity: "maintainer", mask: true },
  { field: "name", sensitivity: "maintainer", mask: true },
  { field: "email", sensitivity: "maintainer", mask: true },
];

/**
 * Thrown when an error context cannot be made privacy-safe for the requested
 * audience because it contains mandatory sensitive fields without rules.
 */
export class PrivacySafeErrorContextError extends Error {
  public readonly result: PrivacySafeErrorContextResult;

  constructor(message: string, result: PrivacySafeErrorContextResult) {
    super(message);
    this.name = "PrivacySafeErrorContextError";
    this.result = result;
  }
}

/**
 * Assert that an error context is privacy-safe for the audience. Throws
 * {@link PrivacySafeErrorContextError} carrying the full filtered result when
 * sensitive fields were redacted, so callers can render what was removed.
 */
export function assertPrivacySafeErrorContext(
  context: unknown,
  options: PrivacySafeErrorContextOptions,
): PrivacySafeErrorContextResult {
  const result = filterErrorContext(context, options);
  if (!result.isPrivacySafe) {
    throw new PrivacySafeErrorContextError(
      `Error context contains ${result.redactedFields.length} field(s) not safe for ${options.audience} audience.`,
      result,
    );
  }
  return result;
}

export { AUDIENCE_RANK, ALWAYS_SENSITIVE_FIELDS };