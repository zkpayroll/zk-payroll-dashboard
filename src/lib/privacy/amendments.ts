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
