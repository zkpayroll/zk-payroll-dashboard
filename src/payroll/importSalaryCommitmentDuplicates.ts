/**
 * Duplicate salary commitment detection for employee imports (#749).
 *
 * Every imported employee row is turned into a ZK salary commitment before it
 * joins the directory (see `components/features/employees/CsvImport.tsx`).
 * The commitment binds one hidden salary to one wallet address. When two
 * import rows commit the *same* salary to the *same* wallet, the import would
 * create two commitments to the same hidden statement — the employee would be
 * paid twice for the same period, and the directory would hold two records
 * that are indistinguishable on-chain.
 *
 * Rules:
 * 1. `duplicate_salary_commitment` — two or more rows bind the same salary
 *    amount to the same wallet address. Blocking: the operator must keep a
 *    single row (or exclude the group) before the import can proceed.
 * 2. `identical_commitment_value` — two or more rows carry the exact same
 *    commitment string. Blocking: the same commitment must never appear twice
 *    in the directory.
 *
 * A repeated salary across *different* wallets is not a duplicate commitment
 * (two people can legitimately earn the same amount), and the same wallet
 * with *different* salaries is a wallet collision that the import conflict
 * resolver already reports.
 *
 * Privacy guarantees:
 * - Raw salary amounts never appear in a message, a remediation hint, or any
 *   other value produced by this module. Only masked wallet addresses
 *   (`GDQP2K…4W37`) and truncated commitment values are exposed.
 * - Employee names are optional and only used for operator-facing context.
 * - The module is pure: it never reads the clock, never mutates its input.
 */

import { maskPaymentAddress } from "@/lib/duplicateDetection";

/** A single import row considered by the duplicate detector. */
export interface SalaryCommitmentImportRow {
  /** 1-based row number of the source file. */
  rowIndex: number;
  /** Wallet address the salary would be committed to. */
  address: string;
  /** Salary amount, either numeric or the raw string from the source file. */
  salary: number | string;
  /** Employee name, used only for operator-facing context. */
  name?: string | null;
  /** Commitment already carried by the row, when the source provides one. */
  salaryCommitment?: string | null;
}

/** The kind of duplicate commitment detected in an import. */
export type SalaryCommitmentDuplicateKind =
  | "duplicate_salary_commitment"
  | "identical_commitment_value";

/**
 * Privacy-safe view of an import row that takes part in a duplicate group.
 *
 * The raw row never leaves the detector: the salary amount and the full
 * wallet address are dropped so a group can be rendered, logged, or persisted
 * without leaking payroll data.
 */
export interface SalaryCommitmentDuplicateRow {
  /** 1-based row number of the source file. */
  rowIndex: number;
  /** Employee name, when the source row carries one. */
  name?: string | null;
  /** Masked wallet address. */
  address: string;
  /** Truncated commitment value, when the source row carries one. */
  commitment: string | null;
}

export interface SalaryCommitmentDuplicateGroup {
  kind: SalaryCommitmentDuplicateKind;
  /** Stable identifier for the group, safe to use as a React key. */
  id: string;
  /** Masked wallet address the duplicated commitment binds to. */
  address: string;
  /** Truncated commitment value, present for `identical_commitment_value`. */
  commitment: string | null;
  /** Privacy-safe rows participating in the duplicate, in source order. */
  rows: SalaryCommitmentDuplicateRow[];
  /** Row numbers of the participating rows. */
  rowIndexes: number[];
  /** Operator-facing explanation. Never contains a raw salary amount. */
  message: string;
  /** Actionable remediation copy. Never contains a raw salary amount. */
  actionableRemediation: string;
  /** True when the duplicate must be resolved before the import proceeds. */
  isBlocking: boolean;
}

export interface SalaryCommitmentDuplicateReport {
  /** True when at least one duplicate commitment was found. */
  isDuplicate: boolean;
  /** True when at least one duplicate blocks the import. */
  isBlocking: boolean;
  /** Every duplicate group, sorted by the first participating row. */
  groups: SalaryCommitmentDuplicateGroup[];
  /** Row numbers participating in at least one duplicate group. */
  affectedRowIndexes: number[];
  /** One-line, privacy-safe summary of the report. */
  summary: string;
}

/**
 * Normalize a salary amount the same way the import commits it.
 *
 * Mirrors `parseFloat` semantics used by the CSV import so detection and the
 * committed value never disagree. Returns `null` for values that are not a
 * usable positive amount — those rows are rejected by CSV validation and are
 * therefore ignored here instead of producing misleading duplicates.
 */
export function normalizeImportSalary(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const parsed = Number.parseFloat(String(value).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Mask a commitment value for display (`0x8fae32bc…`).
 *
 * Commitments are already safe to publish; only the tail is trimmed so an
 * operator can still match two rows by eye.
 */
export function maskCommitmentValue(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 10)}…${trimmed.slice(-4)}`;
}

/**
 * Strip a raw import row down to the privacy-safe fields a duplicate group
 * is allowed to carry.
 */
function toPrivacySafeRow(
  row: SalaryCommitmentImportRow,
): SalaryCommitmentDuplicateRow {
  return {
    rowIndex: row.rowIndex,
    name: row.name ?? null,
    address: maskPaymentAddress((row.address ?? "").trim()),
    commitment: row.salaryCommitment
      ? maskCommitmentValue(row.salaryCommitment)
      : null,
  };
}

/**
 * Detect rows of an import that would create a duplicate salary commitment.
 *
 * Pure: never reads the clock, never mutates its arguments.
 */
export function findDuplicateSalaryCommitments(
  rows: SalaryCommitmentImportRow[],
): SalaryCommitmentDuplicateGroup[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const usable = rows.filter(
    (row): row is SalaryCommitmentImportRow =>
      Boolean(row) && typeof row === "object",
  );
  if (usable.length === 0) return [];

  const groups: SalaryCommitmentDuplicateGroup[] = [];

  // 1. Same wallet + same salary amount → the same hidden statement.
  const byBinding = new Map<string, SalaryCommitmentImportRow[]>();
  for (const row of usable) {
    const address = (row.address ?? "").trim().toUpperCase();
    const salary = normalizeImportSalary(row.salary);
    if (!address || salary === null) continue;

    const key = `${address}::${salary}`;
    const bucket = byBinding.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      byBinding.set(key, [row]);
    }
  }

  for (const [key, groupRows] of Array.from(byBinding.entries())) {
    if (groupRows.length < 2) continue;
    const address = (groupRows[0].address ?? "").trim();
    const masked = maskPaymentAddress(address) || key.split("::")[0];
    const rowIndexes = groupRows.map((row) => row.rowIndex);

    groups.push({
      kind: "duplicate_salary_commitment",
      id: `dup_salary_${rowIndexes.join("_")}`,
      address: masked,
      commitment: null,
      rows: groupRows.map(toPrivacySafeRow),
      rowIndexes,
      message: `Rows ${rowIndexes.join(", ")} commit the same salary to wallet ${masked}. Importing them all would create ${groupRows.length} commitments to the same hidden salary for the same wallet.`,
      actionableRemediation:
        "Keep a single row for this wallet, or exclude every row in the group, before importing.",
      isBlocking: true,
    });
  }

  // 2. The exact same commitment value carried by more than one row.
  const byCommitment = new Map<string, SalaryCommitmentImportRow[]>();
  for (const row of usable) {
    const commitment = (row.salaryCommitment ?? "").trim();
    if (!commitment) continue;
    const key = commitment.toLowerCase();
    const bucket = byCommitment.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      byCommitment.set(key, [row]);
    }
  }

  for (const [key, groupRows] of Array.from(byCommitment.entries())) {
    if (groupRows.length < 2) continue;
    const masked = maskCommitmentValue(groupRows[0].salaryCommitment ?? "");
    const rowIndexes = groupRows.map((row) => row.rowIndex);

    groups.push({
      kind: "identical_commitment_value",
      id: `dup_commitment_${rowIndexes.join("_")}`,
      address: maskPaymentAddress((groupRows[0].address ?? "").trim()),
      commitment: masked,
      rows: groupRows.map(toPrivacySafeRow),
      rowIndexes,
      message: `Rows ${rowIndexes.join(", ")} carry the same salary commitment ${masked}. The same commitment must appear only once in the directory.`,
      actionableRemediation:
        "Keep a single row for this commitment, or exclude every row in the group, before importing.",
      isBlocking: true,
    });
  }

  return groups.sort((a, b) => {
    const firstA = a.rowIndexes[0] ?? 0;
    const firstB = b.rowIndexes[0] ?? 0;
    return firstA - firstB;
  });
}

/**
 * Evaluate an import and report every duplicate salary commitment it holds.
 */
export function evaluateDuplicateSalaryCommitments(
  rows: SalaryCommitmentImportRow[],
): SalaryCommitmentDuplicateReport {
  const groups = findDuplicateSalaryCommitments(rows);
  const isBlocking = groups.some((group) => group.isBlocking);
  const affectedRowIndexes = Array.from(
    new Set(groups.flatMap((group) => group.rowIndexes)),
  ).sort((a, b) => a - b);

  let summary: string;
  if (groups.length === 0) {
    summary = "No duplicate salary commitments detected. This import is safe to proceed.";
  } else if (isBlocking) {
    summary = `${groups.length} duplicate salary commitment${
      groups.length === 1 ? "" : "s"
    } must be resolved before importing.`;
  } else {
    summary = `${groups.length} duplicate salary commitment warning${
      groups.length === 1 ? "" : "s"
    } detected. Review the details before importing.`;
  }

  return {
    isDuplicate: groups.length > 0,
    isBlocking,
    groups,
    affectedRowIndexes,
    summary,
  };
}

/**
 * Convenience predicate: would this import create a duplicate commitment?
 */
export function hasDuplicateSalaryCommitments(
  rows: SalaryCommitmentImportRow[],
): boolean {
  return findDuplicateSalaryCommitments(rows).length > 0;
}
