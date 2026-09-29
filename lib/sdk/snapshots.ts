/**
 * Payroll obligation snapshot SDK (#404 — Snapshot review workspace).
 *
 * Maintainers review obligation snapshot metadata and row-level diffs before
 * locking a payroll run for execution. Raw salary values are never included —
 * only merkle roots, commitment hashes, employee counts, and safe metadata.
 */

import {
  computeBatchDiff,
  summarizeBatchDiff,
  type BatchRow,
} from "@/lib/payroll/batchDiff";

export type SnapshotLockStatus =
  | "pending"
  | "approved"
  | "locked"
  | "blocked"
  | "failed"
  | "stale";

export interface PayrollObligationSnapshot {
  id: string;
  payrollId: string;
  period: string;
  snapshotVersion: number;
  previousSnapshotVersion?: number;
  /** Merkle root of obligation rows — safe to display (truncated in UI). */
  merkleRoot: string;
  previousMerkleRoot?: string;
  employeeCount: number;
  assetCode: string;
  lockStatus: SnapshotLockStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Operator rationale — privacy-safe copy only. */
  reason?: string;
  /** Current obligation rows in this snapshot. */
  currentRows: BatchRow[];
  /** Previous locked snapshot rows for diff comparison. */
  previousRows: BatchRow[];
  /** True when a newer snapshot version supersedes this one. */
  isStale?: boolean;
  staleReason?: string;
  /** True when row-level diff passes lock-readiness checks. */
  isDiffValid?: boolean;
  diffInvalidReason?: string;
}

export interface SnapshotLockValidation {
  canApproveLock: boolean;
  isStale: boolean;
  isDiffValid: boolean;
  hasBlockedRows: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  nextSteps?: string;
}

export interface SnapshotDiffField {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface SnapshotSafeDiff {
  fields: SnapshotDiffField[];
  hasChanges: boolean;
  rowSummary: {
    additions: number;
    removals: number;
    edits: number;
    unchanged: number;
    blocked: number;
    total: number;
  };
}

const WALLET_A = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const WALLET_B = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
const WALLET_C = "GCZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2";
const WALLET_D = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W38";

function row(
  employeeId: string,
  name: string,
  walletAddress: string,
  assetCode: string,
  salaryCommitment: string,
  salaryAmount?: number,
): BatchRow {
  return { employeeId, name, walletAddress, assetCode, salaryCommitment, salaryAmount };
}

export function formatMerkleRoot(root: string, visible = 12): string {
  if (!root) return "—";
  if (root.length <= visible + 6) return root;
  return `${root.slice(0, visible)}…${root.slice(-6)}`;
}

export function validateSnapshotLockReadiness(
  snapshot: PayrollObligationSnapshot,
): SnapshotLockValidation {
  const diffEntries = computeBatchDiff(snapshot.currentRows, snapshot.previousRows);
  const rowSummary = summarizeBatchDiff(diffEntries);
  const isStale = snapshot.isStale ?? false;
  const isDiffValid = snapshot.isDiffValid ?? true;
  const hasBlockedRows = rowSummary.blocked > 0;
  const isBlockedStatus =
    snapshot.lockStatus === "blocked" ||
    snapshot.lockStatus === "failed" ||
    snapshot.lockStatus === "locked" ||
    snapshot.lockStatus === "stale";
  const isBlocked = isStale || !isDiffValid || hasBlockedRows || isBlockedStatus;

  let blockedReason: string | undefined;
  let nextSteps: string | undefined;

  if (isStale) {
    blockedReason =
      snapshot.staleReason ??
      "This snapshot is stale — a newer obligation snapshot already exists.";
    nextSteps =
      "Open the latest snapshot version and confirm lock readiness before execution.";
  } else if (!isDiffValid) {
    blockedReason =
      snapshot.diffInvalidReason ??
      "Row-level diff failed validation for lock readiness.";
    nextSteps = "Regenerate the obligation snapshot and resolve diff blockers.";
  } else if (hasBlockedRows) {
    blockedReason = `${rowSummary.blocked} obligation row(s) require re-approval before lock.`;
    nextSteps =
      "Review blocked rows in the diff panel and refresh commitments or remove stale recipients.";
  } else if (snapshot.lockStatus === "blocked") {
    blockedReason = "This snapshot is blocked pending operator review.";
    nextSteps = "Resolve blockers listed in the diff and retry lock approval.";
  } else if (snapshot.lockStatus === "failed") {
    blockedReason = "Snapshot generation failed verification.";
    nextSteps = "Regenerate the obligation snapshot. Salary values remain private.";
  } else if (snapshot.lockStatus === "locked") {
    nextSteps = "Snapshot already locked — execution may proceed with this frozen obligation set.";
  } else if (snapshot.lockStatus === "approved") {
    nextSteps = "Snapshot approved — confirm lock to freeze obligations for execution.";
  } else if (snapshot.lockStatus === "pending") {
    nextSteps =
      "Review safe metadata and obligation diffs below, then approve lock readiness. Salary values stay encrypted.";
  }

  const canApproveLock =
    !isBlocked &&
    snapshot.lockStatus === "pending" &&
    !isStale &&
    isDiffValid &&
    !hasBlockedRows;

  return {
    canApproveLock,
    isStale,
    isDiffValid,
    hasBlockedRows,
    isBlocked,
    blockedReason,
    nextSteps,
  };
}

export function getSnapshotSafeDiff(
  snapshot: PayrollObligationSnapshot,
): SnapshotSafeDiff {
  const diffEntries = computeBatchDiff(snapshot.currentRows, snapshot.previousRows);
  const rowSummary = summarizeBatchDiff(diffEntries);

  const fields: SnapshotDiffField[] = [
    {
      label: "Snapshot version",
      before: snapshot.previousSnapshotVersion
        ? `v${snapshot.previousSnapshotVersion}`
        : "—",
      after: `v${snapshot.snapshotVersion}`,
      changed:
        snapshot.previousSnapshotVersion !== undefined &&
        snapshot.previousSnapshotVersion !== snapshot.snapshotVersion,
    },
    {
      label: "Payroll period",
      before: snapshot.period,
      after: snapshot.period,
      changed: false,
    },
    {
      label: "Employee count",
      before: String(snapshot.previousRows.length),
      after: String(snapshot.employeeCount),
      changed: snapshot.previousRows.length !== snapshot.employeeCount,
    },
    {
      label: "Asset",
      before: snapshot.assetCode,
      after: snapshot.assetCode,
      changed: false,
    },
    {
      label: "Lock status",
      before: snapshot.lockStatus,
      after: snapshot.lockStatus,
      changed: false,
    },
    {
      label: "Merkle root",
      before: snapshot.previousMerkleRoot
        ? formatMerkleRoot(snapshot.previousMerkleRoot)
        : "—",
      after: formatMerkleRoot(snapshot.merkleRoot),
      changed:
        !!snapshot.previousMerkleRoot &&
        snapshot.previousMerkleRoot !== snapshot.merkleRoot,
    },
  ];

  return {
    fields,
    hasChanges: fields.some((f) => f.changed) || rowSummary.total !== rowSummary.unchanged,
    rowSummary,
  };
}

export const MOCK_SNAPSHOTS: PayrollObligationSnapshot[] = [
  {
    id: "snap_valid_001",
    payrollId: "pr_2025_03",
    period: "2025-03",
    snapshotVersion: 2,
    previousSnapshotVersion: 1,
    merkleRoot: "0xmerkle_root_v2_obligation_hash_safe",
    previousMerkleRoot: "0xmerkle_root_v1_obligation_hash_safe",
    employeeCount: 2,
    assetCode: "USDC",
    lockStatus: "pending",
    createdAt: "2025-03-10T08:00:00Z",
    updatedAt: "2025-03-10T08:00:00Z",
    createdBy: "Payroll Operator",
    reason: "Pre-execution obligation snapshot for March payroll.",
    previousRows: [
      row("emp_001", "Employee #1", WALLET_A, "USDC", "0xabc123def456", 3500),
    ],
    currentRows: [
      row("emp_001", "Employee #1", WALLET_A, "USDC", "0xabc123def456", 3500),
      row("emp_003", "Employee #3", WALLET_C, "USDC", "0xnew333commit", 2800),
    ],
    isStale: false,
    isDiffValid: true,
  },
  {
    id: "snap_stale_001",
    payrollId: "pr_2025_03",
    period: "2025-03",
    snapshotVersion: 2,
    previousSnapshotVersion: 1,
    merkleRoot: "0xmerkle_stale_v2_hash",
    previousMerkleRoot: "0xmerkle_stale_v1_hash",
    employeeCount: 2,
    assetCode: "USDC",
    lockStatus: "pending",
    createdAt: "2025-03-08T09:00:00Z",
    updatedAt: "2025-03-12T10:00:00Z",
    createdBy: "Payroll Operator",
    reason: "Superseded snapshot — newer version published.",
    previousRows: [
      row("emp_001", "Employee #1", WALLET_A, "USDC", "0xabc123def456", 3500),
    ],
    currentRows: [
      row("emp_001", "Employee #1", WALLET_A, "USDC", "0xabc123def456", 3500),
      row("emp_003", "Employee #3", WALLET_C, "USDC", "0xnew333commit", 2800),
    ],
    isStale: true,
    staleReason: "Snapshot v3 already exists. This review workspace is stale.",
    isDiffValid: true,
  },
  {
    id: "snap_blocked_001",
    payrollId: "pr_2025_04",
    period: "2025-04",
    snapshotVersion: 1,
    merkleRoot: "0xmerkle_blocked_v1_hash",
    employeeCount: 2,
    assetCode: "USDC",
    lockStatus: "blocked",
    createdAt: "2025-04-01T08:00:00Z",
    updatedAt: "2025-04-01T09:00:00Z",
    createdBy: "Payroll Operator",
    reason: "Commitment rotation detected — blocked rows need review.",
    previousRows: [
      row("emp_001", "Employee #1", WALLET_A, "USDC", "0xabc123def456", 3500),
    ],
    currentRows: [
      row("emp_001", "Employee #1", WALLET_A, "USDC", "0xrotated_commit_blocked", 3500),
    ],
    isStale: false,
    isDiffValid: true,
  },
  {
    id: "snap_failed_001",
    payrollId: "pr_2025_02",
    period: "2025-02",
    snapshotVersion: 1,
    merkleRoot: "0xmerkle_failed_v1_hash",
    employeeCount: 1,
    assetCode: "XLM",
    lockStatus: "failed",
    createdAt: "2025-02-20T07:00:00Z",
    updatedAt: "2025-02-21T08:00:00Z",
    createdBy: "System",
    reason: "Merkle root verification failed during snapshot build.",
    previousRows: [],
    currentRows: [
      row("emp_002", "Employee #2", WALLET_B, "XLM", "0xxlm444commit", 15000),
    ],
    isStale: false,
    isDiffValid: false,
    diffInvalidReason: "Computed merkle root does not match published root.",
  },
  {
    id: "snap_locked_001",
    payrollId: "pr_2025_02",
    period: "2025-02",
    snapshotVersion: 3,
    previousSnapshotVersion: 2,
    merkleRoot: "0xmerkle_locked_v3_hash",
    previousMerkleRoot: "0xmerkle_locked_v2_hash",
    employeeCount: 2,
    assetCode: "USDC",
    lockStatus: "locked",
    createdAt: "2025-02-05T09:00:00Z",
    updatedAt: "2025-02-06T10:00:00Z",
    createdBy: "Payroll Operator",
    reason: "Locked for February execution.",
    previousRows: [
      row("emp_001", "Employee #1", WALLET_A, "USDC", "0xabc123def456", 3500),
      row("emp_002", "Employee #2", WALLET_B, "USDC", "0xdef789ghi012", 3200),
    ],
    currentRows: [
      row("emp_001", "Employee #1", WALLET_A, "USDC", "0xabc123def456", 3500),
      row("emp_002", "Employee #2", WALLET_B, "USDC", "0xdef789ghi012", 3200),
    ],
    isStale: false,
    isDiffValid: true,
  },
  {
    id: "snap_wallet_change_001",
    payrollId: "pr_2025_04",
    period: "2025-04",
    snapshotVersion: 1,
    merkleRoot: "0xmerkle_wallet_change_hash",
    employeeCount: 1,
    assetCode: "USDC",
    lockStatus: "pending",
    createdAt: "2025-04-02T08:00:00Z",
    updatedAt: "2025-04-02T08:00:00Z",
    createdBy: "Payroll Operator",
    reason: "Wallet update captured in obligation snapshot.",
    previousRows: [
      row("emp_001", "Employee #1", WALLET_A, "USDC", "0xabc123def456", 3500),
    ],
    currentRows: [
      row("emp_001", "Employee #1", WALLET_D, "USDC", "0xabc123def456", 3500),
    ],
    isStale: false,
    isDiffValid: true,
  },
];

export async function fetchSnapshots(): Promise<PayrollObligationSnapshot[]> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return MOCK_SNAPSHOTS;
}

export async function fetchSnapshotById(
  id: string,
): Promise<PayrollObligationSnapshot | null> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return MOCK_SNAPSHOTS.find((s) => s.id === id) ?? null;
}

export async function validateSnapshotLockReadinessAsync(
  id: string,
): Promise<SnapshotLockValidation | null> {
  const snapshot = await fetchSnapshotById(id);
  if (!snapshot) return null;
  return validateSnapshotLockReadiness(snapshot);
}
