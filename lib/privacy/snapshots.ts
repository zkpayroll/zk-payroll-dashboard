/**
 * Privacy-safe helpers for payroll obligation snapshot review (#404).
 *
 * Salary values are encrypted end-to-end and must never appear in the UI.
 * Snapshot review shows merkle roots, commitment hashes, and row metadata only.
 */

import type { PayrollObligationSnapshot } from "@/lib/sdk/snapshots";
import { formatMerkleRoot } from "@/lib/sdk/snapshots";

export const SNAPSHOT_PRIVACY_NOTICE =
  "Salary values remain encrypted. This workspace shows only safe metadata — merkle roots, commitment hashes, employee counts, and obligation diffs.";

export const SNAPSHOT_MERKLE_COPY =
  "Merkle roots are privacy-safe digests of obligation rows. They verify the snapshot matches execution without revealing salary amounts.";

export const SNAPSHOT_SENSITIVE_COPY =
  "Encrypted obligation rows — raw salary amounts are redacted. Only commitment hashes and wallet references are shown.";

export function formatSnapshotHash(hash: string, visible = 12): string {
  return formatMerkleRoot(hash, visible);
}

export function getSnapshotPrivacyFields(): string[] {
  return [
    "snapshotVersion",
    "period",
    "employeeCount",
    "assetCode",
    "lockStatus",
    "merkleRoot",
    "salaryCommitment",
    "walletAddress",
  ];
}

export function buildSnapshotPrivacySummary(
  snapshot: PayrollObligationSnapshot,
): string {
  const lines: string[] = [];
  lines.push(`Snapshot ${snapshot.id}`);
  lines.push(`Payroll: ${snapshot.payrollId}`);
  lines.push(`Period: ${snapshot.period}`);
  lines.push(`Version: v${snapshot.snapshotVersion}`);
  lines.push(`Employees: ${snapshot.employeeCount}`);
  lines.push(`Asset: ${snapshot.assetCode}`);
  lines.push(`Lock status: ${snapshot.lockStatus}`);
  lines.push(`Merkle root: ${formatSnapshotHash(snapshot.merkleRoot)}`);
  lines.push("");
  lines.push(SNAPSHOT_PRIVACY_NOTICE);
  return lines.join("\n");
}

/**
 * QA helper: asserts that no raw salary values leak into rendered text.
 */
export function containsRawSalaryLeak(text: string, rawValues: number[]): boolean {
  return rawValues.some((v) => text.includes(String(v)));
}

export function isSnapshotSafeToDisplay(snapshot: Record<string, unknown>): boolean {
  const bannedKeys = ["salary", "salaryAmount", "amount", "privateInputs", "secret", "seed"];
  return !Object.keys(snapshot).some((k) => bannedKeys.includes(k));
}
