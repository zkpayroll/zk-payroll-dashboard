import type { Employee } from "@/types/models";
import type { CommitmentChangeKind } from "./commitmentReplacementReview";
import type { CommitmentReplacementLogEntry } from "@/stores/employees";

/**
 * Salary commitment version recovery domain logic (#900, #962).
 *
 * Operators periodically need to inspect historical salary commitment versions
 * and recover or restore a previous version (e.g. after a bad import, circuit
 * mismatch, or rollbacked compensation adjustment).
 *
 * PRIVACY GUARANTEES:
 * - Raw salary amounts and private inputs are NEVER handled, returned, or exposed.
 * - Only truncated cryptographic commitment hash previews and safe metadata
 *   (version numbers, timestamps, status badges, operator attribution) are rendered.
 * - Error messages and recovery guidance protect confidential compensation.
 */

export type CommitmentVersionStatus = "active" | "superseded" | "restored";

export interface SalaryCommitmentVersion {
  id: string;
  employeeId: string;
  version: number;
  commitment: string;
  commitmentPreview: string;
  address?: string;
  addressPreview?: string;
  createdAt: string;
  confirmedBy?: string;
  status: CommitmentVersionStatus;
  restoredFromVersion?: number;
  changeKind?: CommitmentChangeKind;
  isRecovery?: boolean;
}

export type CommitmentRecoveryErrorCode =
  | "EMPLOYEE_NOT_FOUND"
  | "VERSION_NOT_FOUND"
  | "VERSION_ALREADY_ACTIVE"
  | "COMMITMENT_EMPTY"
  | "COMMITMENT_MALFORMED"
  | "COMMITMENT_UNCHANGED";

export interface CommitmentRecoveryError {
  code: CommitmentRecoveryErrorCode;
  message: string;
  suggestedAction: string;
}

export interface CommitmentRecoveryReview {
  employeeId: string;
  targetVersion: number;
  currentVersion: number;
  nextVersion: number;
  targetCommitment: string;
  currentCommitmentPreview: string;
  recoveredCommitmentPreview: string;
  walletChanged: boolean;
  previousWalletPreview?: string;
  recoveredWalletPreview?: string;
  targetAddress?: string;
  recoveryGuidance: string;
  restoredFromVersion: number;
}

export type CommitmentRecoveryResult =
  | { ok: true; review: CommitmentRecoveryReview }
  | { ok: false; error: CommitmentRecoveryError };

export interface CommitmentRecoveryRequest {
  employee: Employee | undefined;
  targetVersion: number;
  versionHistory?: SalaryCommitmentVersion[];
  confirmedBy?: string;
  recoveryReason?: string;
}

const MIN_COMMITMENT_LENGTH = 8;

export function truncate(value: string, length = 10): string {
  if (!value) return "";
  return value.length <= length ? value : `${value.slice(0, length)}…`;
}

export function isWellFormedCommitment(commitment: string): boolean {
  return commitment.trim().length >= MIN_COMMITMENT_LENGTH;
}

/**
 * Reconstructs a comprehensive version history for an employee from their base
 * record and any confirmed replacements recorded in `commitmentReplacementLog`.
 */
export function buildCommitmentVersionHistory(
  employee: Employee | undefined,
  logEntries: CommitmentReplacementLogEntry[] = [],
): SalaryCommitmentVersion[] {
  if (!employee) return [];

  const employeeLogs = logEntries
    .filter((entry) => entry.employeeId === employee.id)
    .sort((a, b) => new Date(a.confirmedAt).getTime() - new Date(b.confirmedAt).getTime());

  const versions: SalaryCommitmentVersion[] = [];

  // Version 1 is the baseline commitment from onboarding or initial record.
  const hasSubsequentReplacements = employeeLogs.length > 0;
  const initialCommitment = hasSubsequentReplacements
    ? employeeLogs[0].previousCommitment || employeeLogs[0].previousCommitmentPreview || employee.salaryCommitment
    : employee.salaryCommitment;
  const initialAddress = employeeLogs[0]?.previousAddress || employee.address;

  versions.push({
    id: `${employee.id}-commit-v1`,
    employeeId: employee.id,
    version: 1,
    commitment: initialCommitment,
    commitmentPreview: truncate(initialCommitment),
    address: initialAddress,
    addressPreview: initialAddress ? truncate(initialAddress) : undefined,
    createdAt: employee.startDate,
    confirmedBy: "Initial record",
    status: hasSubsequentReplacements ? "superseded" : "active",
    changeKind: "commitment_only",
    isRecovery: false,
  });

  // Build versions from subsequent confirmed replacements
  for (let i = 0; i < employeeLogs.length; i++) {
    const entry = employeeLogs[i];
    const versionNumber = entry.version ?? i + 2;
    const isLatest = i === employeeLogs.length - 1;
    const commitment =
      entry.nextCommitment ||
      (isLatest ? employee.salaryCommitment : entry.nextCommitmentPreview);
    const address = entry.nextAddress || employee.address;
    const isRestored = Boolean(entry.isRecovery || entry.restoredFromVersion);

    let status: CommitmentVersionStatus;
    if (isLatest) {
      status = isRestored ? "restored" : "active";
    } else {
      status = "superseded";
    }

    versions.push({
      id: entry.id || `${employee.id}-commit-v${versionNumber}`,
      employeeId: employee.id,
      version: versionNumber,
      commitment,
      commitmentPreview: truncate(commitment),
      address,
      addressPreview: address ? truncate(address) : undefined,
      createdAt: entry.confirmedAt,
      confirmedBy: entry.confirmedBy || "Operator",
      status,
      restoredFromVersion: entry.restoredFromVersion,
      changeKind: entry.changeKind,
      isRecovery: isRestored,
    });
  }

  return versions;
}

/**
 * Validates a version recovery proposal before mutating state.
 * Returns a strongly-typed, privacy-safe review or an actionable error.
 */
export function reviewCommitmentVersionRecovery(
  request: CommitmentRecoveryRequest,
): CommitmentRecoveryResult {
  const { employee, targetVersion, versionHistory, recoveryReason } = request;

  if (!employee) {
    return {
      ok: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: "The employee record could not be found. Refresh and try again.",
        suggestedAction: "Select an employee from the employee directory.",
      },
    };
  }

  const history = versionHistory && versionHistory.length > 0
    ? versionHistory
    : buildCommitmentVersionHistory(employee, []);

  const target = history.find((v) => v.version === targetVersion);
  if (!target) {
    return {
      ok: false,
      error: {
        code: "VERSION_NOT_FOUND",
        message: `Salary commitment version v${targetVersion} was not found for this employee.`,
        suggestedAction: "Choose an existing version from the commitment history table.",
      },
    };
  }

  // Check if target is already active
  const isAlreadyActive =
    target.status === "active" ||
    target.status === "restored" ||
    target.commitment === employee.salaryCommitment;

  if (isAlreadyActive) {
    return {
      ok: false,
      error: {
        code: "VERSION_ALREADY_ACTIVE",
        message: `Commitment version v${targetVersion} is already the active version on this employee.`,
        suggestedAction: "Select an earlier superseded version to restore.",
      },
    };
  }

  const trimmedTargetCommitment = target.commitment.trim();

  if (trimmedTargetCommitment.length === 0) {
    return {
      ok: false,
      error: {
        code: "COMMITMENT_EMPTY",
        message: "The selected commitment version contains an empty hash and cannot be recovered.",
        suggestedAction: "Select a valid historical commitment version.",
      },
    };
  }

  if (!isWellFormedCommitment(trimmedTargetCommitment)) {
    return {
      ok: false,
      error: {
        code: "COMMITMENT_MALFORMED",
        message: "The target commitment hash is too short or malformed to be recovered.",
        suggestedAction: "Re-generate the commitment through the replacement review flow.",
      },
    };
  }

  if (trimmedTargetCommitment === employee.salaryCommitment) {
    return {
      ok: false,
      error: {
        code: "COMMITMENT_UNCHANGED",
        message: "The target commitment matches the current active commitment — nothing to recover.",
        suggestedAction: "Choose a prior version with a different commitment hash.",
      },
    };
  }

  const currentVersionRecord = history.find((v) => v.status === "active" || v.status === "restored");
  const currentVersion = currentVersionRecord ? currentVersionRecord.version : 1;
  const maxVersion = Math.max(...history.map((v) => v.version), currentVersion);
  const nextVersion = maxVersion + 1;

  const walletChanged = Boolean(target.address && target.address !== employee.address);

  const recoveryGuidance = `Recovering to Version ${target.version}. This will activate commitment ${truncate(trimmedTargetCommitment)} as Version ${nextVersion} (Restored from v${target.version}) for zero-knowledge verification in subsequent payroll runs without modifying private salary figures.${recoveryReason ? ` Reason: ${recoveryReason}` : ""}`;

  return {
    ok: true,
    review: {
      employeeId: employee.id,
      targetVersion: target.version,
      currentVersion,
      nextVersion,
      targetCommitment: trimmedTargetCommitment,
      currentCommitmentPreview: truncate(employee.salaryCommitment),
      recoveredCommitmentPreview: truncate(trimmedTargetCommitment),
      walletChanged,
      previousWalletPreview: walletChanged ? truncate(employee.address) : undefined,
      recoveredWalletPreview: walletChanged && target.address ? truncate(target.address) : undefined,
      targetAddress: walletChanged ? target.address : undefined,
      restoredFromVersion: target.version,
      recoveryGuidance,
    },
  };
}
