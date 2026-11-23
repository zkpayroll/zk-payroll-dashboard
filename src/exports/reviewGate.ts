import {
  resolveExportAccess,
  type ExportAccessDecision,
} from "@/src/permissions/exportAccess";
import type { UserRole } from "@/types";

/**
 * Dashboard payroll export review gate (#270).
 *
 * Builds the review summary a user sees before an export download starts:
 * what the export covers (scope), how sensitive fields are handled
 * (redaction level), and whether the signed in role may download it at all
 * (access restrictions). Restricted exports are blocked with a clear reason
 * and previews only ever render field labels — never values — so private
 * salary data cannot leak through the review step.
 */

export type ExportRedactionLevel = "none" | "partial" | "full";

export const SENSITIVE_EXPORT_FIELD_PATTERNS: RegExp[] = [
  /salary/i,
  /compensation/i,
  /wallet/i,
  /email/i,
  /address/i,
  /phone/i,
  /ssn/i,
];

export const EXPORT_REDACTION_LEVEL_LABELS: Record<ExportRedactionLevel, string> = {
  none: "No redaction",
  partial: "Partially redacted",
  full: "Fully redacted",
};

export interface ExportScopeSummary {
  permissionKey: string;
  title: string;
  scope: string;
  format: string;
  fields: string[];
  privacyNotice: string;
  recordCount?: number | null;
}

export interface ExportRedactionSummary {
  level: ExportRedactionLevel;
  label: string;
  description: string;
  totalFields: number;
  sensitiveFields: string[];
  redactedFields: string[];
  retainedSensitiveFields: string[];
}

export interface ExportPreviewField {
  field: string;
  sensitive: boolean;
  redacted: boolean;
}

export interface ExportReviewGateInput {
  role: UserRole | null;
  scope: ExportScopeSummary;
  redaction: ExportRedactionSummary;
}

export interface ExportReviewGateResult {
  canProceed: boolean;
  access: ExportAccessDecision;
  blockedReasons: string[];
  warnings: string[];
  scopeLine: string;
  redactionLine: string;
}

export function isSensitiveExportField(field: string): boolean {
  return SENSITIVE_EXPORT_FIELD_PATTERNS.some((pattern) => pattern.test(field));
}

function uniqueLowered(values: string[]): Set<string> {
  return new Set(
    (values ?? [])
      .filter((value) => typeof value === "string" && value.trim() !== "")
      .map((value) => value.trim().toLowerCase()),
  );
}

export function summarizeExportRedaction(
  fields: string[],
  redactedFields: string[] = [],
): ExportRedactionSummary {
  const safeFields = (fields ?? []).filter(
    (field) => typeof field === "string" && field.trim() !== "",
  );
  const redactedSet = uniqueLowered(redactedFields);

  const sensitiveFields = safeFields.filter(isSensitiveExportField);
  const redactedApplied = safeFields.filter((field) =>
    redactedSet.has(field.toLowerCase()),
  );
  const retainedSensitiveFields = sensitiveFields.filter(
    (field) => !redactedSet.has(field.toLowerCase()),
  );

  let level: ExportRedactionLevel;
  if (sensitiveFields.length === 0) {
    level = "none";
  } else if (retainedSensitiveFields.length === 0) {
    level = "full";
  } else if (redactedApplied.length > 0) {
    level = "partial";
  } else {
    level = "none";
  }

  let description: string;
  if (sensitiveFields.length === 0) {
    description =
      "This export includes no personal salary, wallet, or contact fields.";
  } else if (level === "full") {
    description = "All sensitive fields are redacted before download.";
  } else if (level === "partial") {
    description =
      "Some sensitive fields are redacted; retained sensitive fields are listed for review.";
  } else {
    description =
      "Sensitive fields are included without redaction. Review the scope before downloading.";
  }

  return {
    level,
    label: EXPORT_REDACTION_LEVEL_LABELS[level],
    description,
    totalFields: safeFields.length,
    sensitiveFields,
    redactedFields: redactedApplied,
    retainedSensitiveFields,
  };
}

export function buildExportPreviewFields(
  scope: ExportScopeSummary,
  redaction: ExportRedactionSummary,
): ExportPreviewField[] {
  const redactedSet = uniqueLowered(redaction.redactedFields);
  return (scope?.fields ?? []).map((field) => ({
    field,
    sensitive: isSensitiveExportField(field),
    redacted: redactedSet.has(field.toLowerCase()),
  }));
}

export function formatExportPreviewText(fields: ExportPreviewField[]): string {
  return fields
    .map((entry) => `${entry.field}: ${entry.redacted ? "REDACTED" : "INCLUDED"}`)
    .join("\n");
}

function buildScopeLine(scope: ExportScopeSummary): string {
  const fields = Array.isArray(scope.fields) ? scope.fields : [];
  const parts = [
    scope.scope || "Unspecified scope",
    scope.format || "Unknown format",
    `${fields.length} ${fields.length === 1 ? "field" : "fields"}`,
  ];
  if (typeof scope.recordCount === "number" && scope.recordCount >= 0) {
    parts.push(`${scope.recordCount} ${scope.recordCount === 1 ? "record" : "records"}`);
  }
  return parts.join(" · ");
}

export function evaluateExportReviewGate(
  input: ExportReviewGateInput,
): ExportReviewGateResult {
  const scope = input.scope;
  const access = resolveExportAccess(input.role, scope?.permissionKey ?? "");

  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  if (!access.allowed && access.reason) {
    blockedReasons.push(access.reason);
  }

  if (!scope || !Array.isArray(scope.fields) || scope.fields.length === 0) {
    blockedReasons.push(
      "The export scope is empty, so there is nothing to download. Select records and try again.",
    );
  }

  if (typeof scope?.recordCount === "number" && scope.recordCount <= 0) {
    blockedReasons.push(
      "No records match the current export scope. Adjust the selection and try again.",
    );
  }

  if (input.redaction?.retainedSensitiveFields?.length) {
    warnings.push(
      `Included sensitive fields: ${input.redaction.retainedSensitiveFields.join(", ")}. Confirm these are permitted for your use before downloading.`,
    );
  }

  return {
    canProceed: blockedReasons.length === 0,
    access,
    blockedReasons,
    warnings,
    scopeLine: scope ? buildScopeLine(scope) : "No export scope selected.",
    redactionLine: input.redaction
      ? `${input.redaction.label}. ${input.redaction.description}`
      : EXPORT_REDACTION_LEVEL_LABELS.none,
  };
}
