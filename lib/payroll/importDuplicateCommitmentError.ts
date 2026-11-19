/**
 * Duplicate commitment error state for payroll import.
 *
 * Detects and reports duplicate salary commitments during payroll import,
 * preventing execution of batches with conflicting commitments.
 * Privacy-safe: masks employee details in error messages.
 */

export interface CommitmentRecord {
  rowIndex: number;
  recipientAddress: string;
  salaryAmount: number;
  metadata?: Record<string, unknown>;
}

export interface DuplicateCommitmentGroup {
  recipientAddress: string;
  salaryAmount: number;
  affectedRows: number[];
  occurrences: number;
}

export interface DuplicateCommitmentCheckResult {
  hasDuplicates: boolean;
  groups: DuplicateCommitmentGroup[];
  errorCount: number;
  message: string;
  isBlocking: boolean;
}

export function normalizeSalaryAmount(amount: number | string): number | null {
  const num =
    typeof amount === "string" ? parseFloat(amount.trim()) : amount;
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function normalizeAddress(address: string): string {
  return address.trim().toUpperCase();
}

export function findDuplicateCommitments(
  records: CommitmentRecord[],
): DuplicateCommitmentGroup[] {
  const commitmentMap = new Map<string, DuplicateCommitmentGroup>();

  for (const record of records) {
    const normalizedAddr = normalizeAddress(record.recipientAddress);
    const normalizedAmount = record.salaryAmount;

    const key = `${normalizedAddr}:${normalizedAmount}`;

    if (!commitmentMap.has(key)) {
      commitmentMap.set(key, {
        recipientAddress: normalizedAddr,
        salaryAmount: normalizedAmount,
        affectedRows: [],
        occurrences: 0,
      });
    }

    const group = commitmentMap.get(key)!;
    group.affectedRows.push(record.rowIndex);
    group.occurrences = group.affectedRows.length;
  }

  return Array.from(commitmentMap.values()).filter(
    (group) => group.occurrences > 1,
  );
}

export function checkDuplicateCommitments(
  records: CommitmentRecord[],
): DuplicateCommitmentCheckResult {
  const duplicateGroups = findDuplicateCommitments(records);

  if (duplicateGroups.length === 0) {
    return {
      hasDuplicates: false,
      groups: [],
      errorCount: 0,
      message: "No duplicate commitments detected.",
      isBlocking: false,
    };
  }

  const errorCount = duplicateGroups.reduce(
    (sum, group) => sum + (group.occurrences - 1),
    0,
  );

  const affectedAddresses = duplicateGroups
    .map((g) => `${maskAddress(g.recipientAddress)}`)
    .join(", ");

  return {
    hasDuplicates: true,
    groups: duplicateGroups,
    errorCount,
    message: `Found ${errorCount} duplicate commitment(s) affecting ${duplicateGroups.length} recipient(s): ${affectedAddresses}. Remove duplicates before importing.`,
    isBlocking: true,
  };
}

export function maskAddress(address: string): string {
  if (!address || address.length < 8) return "***";
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
}

export function formatDuplicateCommitmentError(
  group: DuplicateCommitmentGroup,
): string {
  return `Recipient ${maskAddress(group.recipientAddress)} has ${group.occurrences} identical salary commitments in rows ${group.affectedRows.join(", ")}. Keep only one instance per recipient.`;
}

export function getAllDuplicateErrors(
  groups: DuplicateCommitmentGroup[],
): string[] {
  return groups.map(formatDuplicateCommitmentError);
}

export interface DuplicateCommitmentRemediationGuide {
  summary: string;
  steps: string[];
  preventionTips: string[];
}

export const DUPLICATE_COMMITMENT_REMEDIATION: DuplicateCommitmentRemediationGuide =
  {
    summary:
      "Duplicate salary commitments must be resolved before importing the payroll batch.",
    steps: [
      "Review the import file and locate rows flagged as duplicates.",
      "Identify which row is the authoritative commitment (usually the first one).",
      "Remove all duplicate rows, keeping only the authoritative instance.",
      "Verify salaries and recipient addresses are correct in the remaining row.",
      "Resubmit the corrected import file.",
    ],
    preventionTips: [
      "Use unique identifiers for each employee to prevent accidental duplicates.",
      "Sort imports by recipient address to spot duplicates visually.",
      "Use spreadsheet deduplication tools before exporting to CSV.",
      "Enable duplicate detection warnings in your HR system if available.",
    ],
  };
