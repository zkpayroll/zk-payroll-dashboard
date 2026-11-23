/**
 * Batch diff for payroll approvals (#336).
 *
 * Compares the current payroll draft against the previously approved draft
 * and produces a privacy-safe row-level diff. Raw salary values are treated
 * as private: formatting helpers redact them unless the caller explicitly
 * allows disclosure.
 */

export interface BatchRow {
  employeeId: string;
  name?: string;
  walletAddress: string;
  assetCode: string;
  /** SHA-256 commitment covering the salary — safe to display. */
  salaryCommitment: string;
  /** Private value; never rendered without explicit disclosure. */
  salaryAmount?: number;
}

export type BatchRowChangeType = "added" | "removed" | "edited" | "unchanged";

export type BatchDiffField =
  | "walletAddress"
  | "assetCode"
  | "salaryCommitment"
  | "salaryAmount";

export interface BatchDiffEntry {
  employeeId: string;
  name?: string;
  changeType: BatchRowChangeType;
  changedFields: BatchDiffField[];
  before?: BatchRow;
  after?: BatchRow;
  /**
   * True when the prior approval no longer covers this row (commitment
   * mismatch or removal of a previously approved recipient). These rows
   * require re-approval / a fresh proof.
   */
  isBlocked: boolean;
}

export const REDACTED_PLACEHOLDER = "[REDACTED]";

/** Format a private amount; redacted unless disclosure is explicitly allowed. */
export function formatBatchAmount(
  amount: number | undefined,
  allowPrivate: boolean,
): string {
  if (amount === undefined) return "—";
  if (!allowPrivate) return REDACTED_PLACEHOLDER;
  return `$${amount.toLocaleString()}`;
}

/** Compact wallet display (`GABCD…WXYZ`) to keep diff rows readable. */
export function shortWallet(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function diffFields(
  before: BatchRow,
  after: BatchRow,
): BatchDiffField[] {
  const fields: BatchDiffField[] = [];
  if (before.walletAddress !== after.walletAddress) fields.push("walletAddress");
  if (before.assetCode !== after.assetCode) fields.push("assetCode");
  if (before.salaryCommitment !== after.salaryCommitment)
    fields.push("salaryCommitment");
  if ((before.salaryAmount ?? null) !== (after.salaryAmount ?? null))
    fields.push("salaryAmount");
  return fields;
}

/**
 * Compute the row-level diff between two drafts keyed by employee id.
 * Rows only in `currentRows` are additions; rows only in `approvedRows`
 * are removals; rows in both are edited or unchanged.
 */
export function computeBatchDiff(
  currentRows: BatchRow[],
  approvedRows: BatchRow[],
): BatchDiffEntry[] {
  const approvedByKey = new Map(approvedRows.map((row) => [row.employeeId, row]));
  const currentByKey = new Map(currentRows.map((row) => [row.employeeId, row]));

  const entries: BatchDiffEntry[] = [];

  for (const row of currentRows) {
    const approved = approvedByKey.get(row.employeeId);
    if (!approved) {
      entries.push({
        employeeId: row.employeeId,
        name: row.name,
        changeType: "added",
        changedFields: ["walletAddress", "assetCode", "salaryCommitment"],
        after: row,
        isBlocked: false,
      });
      continue;
    }

    const changedFields = diffFields(approved, row);
    if (changedFields.length === 0) {
      entries.push({
        employeeId: row.employeeId,
        name: row.name,
        changeType: "unchanged",
        changedFields: [],
        before: approved,
        after: row,
        isBlocked: false,
      });
      continue;
    }

    entries.push({
      employeeId: row.employeeId,
      name: row.name,
      changeType: "edited",
      changedFields,
      before: approved,
      after: row,
      isBlocked: changedFields.includes("salaryCommitment"),
    });
  }

  for (const row of approvedRows) {
    if (!currentByKey.has(row.employeeId)) {
      entries.push({
        employeeId: row.employeeId,
        name: row.name,
        changeType: "removed",
        changedFields: [],
        before: row,
        // A previously approved recipient disappearing invalidates the
        // approved batch composition, so it needs re-approval too.
        isBlocked: true,
      });
    }
  }

  return entries;
}

export interface BatchDiffSummary {
  additions: number;
  removals: number;
  edits: number;
  unchanged: number;
  blocked: number;
  total: number;
}

/** Aggregate counts for badges and filter tabs. */
export function summarizeBatchDiff(entries: BatchDiffEntry[]): BatchDiffSummary {
  const count = (predicate: (entry: BatchDiffEntry) => boolean) =>
    entries.filter(predicate).length;

  return {
    additions: count((e) => e.changeType === "added"),
    removals: count((e) => e.changeType === "removed"),
    edits: count((e) => e.changeType === "edited"),
    unchanged: count((e) => e.changeType === "unchanged"),
    blocked: count((e) => e.isBlocked),
    total: entries.length,
  };
}

export type BatchDiffFilter = "all" | "changed" | "unchanged" | "blocked";

const CHANGED_TYPES: BatchRowChangeType[] = ["added", "removed", "edited"];

/** Apply a UI filter to diff entries. */
export function applyBatchDiffFilter(
  entries: BatchDiffEntry[],
  filter: BatchDiffFilter,
): BatchDiffEntry[] {
  switch (filter) {
    case "changed":
      return entries.filter((e) => CHANGED_TYPES.includes(e.changeType));
    case "unchanged":
      return entries.filter((e) => e.changeType === "unchanged");
    case "blocked":
      return entries.filter((e) => e.isBlocked);
    default:
      return entries;
  }
}
