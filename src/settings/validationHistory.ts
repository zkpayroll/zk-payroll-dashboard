import type { ConfigCheck, ValidationResult } from "@/lib/validateCompanyConfig";

export const MAX_SETTINGS_VALIDATION_HISTORY = 50;

export type SettingsValidationStatus = "passed" | "failed";

export interface SettingsValidationFailedCheck {
  id: string;
  label: string;
  message: string;
}

export interface SettingsValidationHistoryEntry {
  id: string;
  companyId: string;
  validatedAt: string;
  status: SettingsValidationStatus;
  errorCount: number;
  warningCount: number;
  failedChecks: SettingsValidationFailedCheck[];
}

export type SettingsValidationHistory = SettingsValidationHistoryEntry[];

export interface RecordSettingsValidationOptions {
  companyId?: string;
  now?: () => Date;
}

export type RecordSettingsValidationResult =
  | { ok: true; entry: SettingsValidationHistoryEntry; history: SettingsValidationHistory }
  | { ok: false; error: string };

export interface SettingsValidationHistoryStats {
  total: number;
  passed: number;
  failed: number;
  lastValidatedAt: string | null;
  lastStatus: SettingsValidationStatus | null;
}

const ALLOWED_CHECK_STATUSES: ReadonlyArray<ConfigCheck["status"]> = ["ok", "error", "warning"];

function isMalformedCheck(check: unknown): boolean {
  if (typeof check !== "object" || check === null) {
    return true;
  }
  const candidate = check as Partial<ConfigCheck>;
  return (
    typeof candidate.id !== "string" ||
    typeof candidate.label !== "string" ||
    typeof candidate.message !== "string" ||
    typeof candidate.status !== "string" ||
    !ALLOWED_CHECK_STATUSES.includes(candidate.status as ConfigCheck["status"])
  );
}

export function recordSettingsValidation(
  history: SettingsValidationHistory,
  validation: ValidationResult,
  options: RecordSettingsValidationOptions = {},
): RecordSettingsValidationResult {
  if (!Array.isArray(history)) {
    return {
      ok: false,
      error:
        "Recording organization settings validation failed: history must be a list of previously recorded entries. Reload the settings page to restore history.",
    };
  }

  if (!validation || !Array.isArray(validation.checks)) {
    return {
      ok: false,
      error:
        "Recording organization settings validation failed: the validation result is missing its checks list. Re-run organization settings validation and try again.",
    };
  }

  if (validation.checks.some(isMalformedCheck)) {
    return {
      ok: false,
      error:
        "Recording organization settings validation failed: a validation check is malformed (expected id, label, message, and status). Re-run organization settings validation and try again.",
    };
  }

  const now = options.now ? options.now() : new Date();
  const validatedAt =
    now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : null;

  if (!validatedAt) {
    return {
      ok: false,
      error:
        "Recording organization settings validation failed: the validation timestamp is invalid. Check the system clock and try again.",
    };
  }

  const checks = validation.checks;
  const failedChecks: SettingsValidationFailedCheck[] = checks
    .filter((check) => check.status === "error")
    .map(({ id, label, message }) => ({ id, label, message }));

  const entry: SettingsValidationHistoryEntry = {
    id: `svh_${now.getTime()}_${Math.random().toString(36).slice(2, 9)}`,
    companyId: options.companyId ?? "unknown",
    validatedAt,
    status: failedChecks.length > 0 ? "failed" : "passed",
    errorCount: failedChecks.length,
    warningCount: checks.filter((check) => check.status === "warning").length,
    failedChecks,
  };

  return {
    ok: true,
    entry,
    history: [entry, ...history].slice(0, MAX_SETTINGS_VALIDATION_HISTORY),
  };
}

export function getSettingsValidationHistoryStats(
  history: SettingsValidationHistory,
): SettingsValidationHistoryStats {
  if (!Array.isArray(history)) {
    return { total: 0, passed: 0, failed: 0, lastValidatedAt: null, lastStatus: null };
  }

  const failed = history.filter((entry) => entry && entry.status === "failed").length;
  const latest = history.length > 0 ? history[0] : null;

  return {
    total: history.length,
    passed: history.length - failed,
    failed,
    lastValidatedAt: latest ? latest.validatedAt : null,
    lastStatus: latest ? latest.status : null,
  };
}
