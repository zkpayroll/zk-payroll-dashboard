/**
 * Privacy-safe helpers for salary commitment amendments.
 *
 * Salary values are encrypted end-to-end and must never appear in the UI.
 * This module centralizes copy and formatting so amendment screens stay
 * safe by default.
 */

import type { SalaryCommitmentAmendment } from "@/lib/sdk/amendments";

export const AMENDMENT_PRIVACY_NOTICE =
  "Salary values remain encrypted. This review shows only safe metadata — commitment hashes, employee reference, period, asset, and approval status.";

export const AMENDMENT_SENSITIVE_COPY =
  "Encrypted salary commitment — raw amount hidden. Only the commitment hash is visible for verification.";

export const AMENDMENT_COMMITMENT_COPY =
  "Commitment hashes are privacy-safe digests of encrypted salary data. They verify correctness without revealing amounts.";

export function formatCommitmentShort(hash: string, visible = 12): string {
  if (!hash) return "—";
  if (hash.length <= visible + 6) return hash;
  return `${hash.slice(0, visible)}…${hash.slice(-6)}`;
}

export function getAmendmentPrivacyFields(): string[] {
  return [
    "commitmentVersion",
    "employeeReference",
    "period",
    "asset",
    "approvalStatus",
    "previousCommitment",
    "nextCommitment",
  ];
}

/**
 * Returns privacy-safe copy for an amendment detail view. Never includes
 * raw salary amounts or secrets.
 */
export function buildAmendmentPrivacySummary(
  amendment: SalaryCommitmentAmendment,
): string {
  const lines: string[] = [];
  lines.push(`Amendment ${amendment.id}`);
  lines.push(`Employee: ${amendment.employeeReference}`);
  lines.push(`Commitment: v${amendment.previousVersion} → v${amendment.commitmentVersion}`);
  lines.push(`Period: ${amendment.period}`);
  lines.push(`Asset: ${amendment.asset.code}`);
  lines.push(`Status: ${amendment.approvalStatus}`);
  lines.push(`Previous hash: ${formatCommitmentShort(amendment.previousCommitment)}`);
  lines.push(`Next hash: ${formatCommitmentShort(amendment.nextCommitment)}`);
  lines.push("");
  lines.push(AMENDMENT_PRIVACY_NOTICE);
  return lines.join("\n");
}

/**
 * QA helper: asserts that no raw salary values leak into rendered text.
 * Used in tests to verify privacy invariant.
 */
export function containsRawSalaryLeak(text: string, rawValues: number[]): boolean {
  return rawValues.some((v) => text.includes(String(v)));
}

export function isAmendmentSafeToDisplay(amendment: Record<string, unknown>): boolean {
  const bannedKeys = ["salary", "salaryAmount", "amount", "privateInputs", "secret", "seed"];
  return !Object.keys(amendment).some((k) => bannedKeys.includes(k));
}

export interface SafeAmendmentExportItem {
  id: string;
  employeeReference: string;
  period: string;
  asset: string;
  commitmentVersion: number;
  previousVersion: number;
  previousCommitment: string;
  nextCommitment: string;
  approvalStatus: string;
  createdAt: string;
}

/**
 * Exports payroll amendment metadata with privacy-safe fields only
 * (hash commitments, version numbers, asset code, period, approval status).
 * Raw salary values are completely excluded.
 */
export function exportAmendmentMetadata(
  amendments: SalaryCommitmentAmendment[],
  format: "json" | "csv" = "json"
): { data: string; filename: string; contentType: string } {
  const safeItems: SafeAmendmentExportItem[] = amendments.map((a) => ({
    id: a.id,
    employeeReference: a.employeeReference,
    period: a.period,
    asset: typeof a.asset === "object" ? a.asset.code : String(a.asset),
    commitmentVersion: a.commitmentVersion,
    previousVersion: a.previousVersion,
    previousCommitment: a.previousCommitment,
    nextCommitment: a.nextCommitment,
    approvalStatus: a.approvalStatus,
    createdAt: a.createdAt || new Date().toISOString(),
  }));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (format === "csv") {
    const headers = [
      "id",
      "employeeReference",
      "period",
      "asset",
      "commitmentVersion",
      "previousVersion",
      "previousCommitment",
      "nextCommitment",
      "approvalStatus",
      "createdAt",
    ];
    const rows = safeItems.map((item) =>
      headers.map((h) => JSON.stringify((item as any)[h] ?? "")).join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");
    return {
      data: csvContent,
      filename: `amendment-metadata-export-${timestamp}.csv`,
      contentType: "text/csv;charset=utf-8;",
    };
  }

  const jsonContent = JSON.stringify(safeItems, null, 2);
  return {
    data: jsonContent,
    filename: `amendment-metadata-export-${timestamp}.json`,
    contentType: "application/json",
  };
}
