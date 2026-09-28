/**
 * Payroll instruction version badge (#534).
 *
 * A payroll "instruction" is the compiled policy payload that governs a run —
 * the saved payroll policy covering settlement timing, reserves, approvals,
 * capacity and audit retention. The policy compiler stamps every compiled
 * result with a `policyVersion` and `compiledDigest`
 * (see `lib/sdk/payrollPolicyCompiler.ts`).
 *
 * The wizard snapshots the governing version when a run draft starts, so a
 * policy edit made mid-run is visible on review instead of silently changing
 * the rules the run will execute under. This module derives the badge state
 * and its privacy-safe labels: version numbers and digests are operational
 * metadata, so no salary, employee, or wallet value ever enters a version
 * badge, message, or event.
 */

import type { PayrollPolicy } from "@/types/policy";

export type InstructionVersionState =
  /** The run follows the saved payroll policy version that is currently active. */
  | "current"
  /** The snapshotted draft version no longer matches the active saved policy. */
  | "stale"
  /** No saved policy version exists to anchor payroll instructions to. */
  | "unconfigured";

export interface InstructionVersionStatus {
  state: InstructionVersionState;
  /** Version of the currently saved (active) payroll policy, or null. */
  version: number | null;
  /** Version snapshotted when the run draft started, or null when unsnapshotted. */
  draftVersion: number | null;
  /** Compact pill label such as "v3", or null when unconfigured. */
  label: string | null;
  /** One-line, privacy-safe explanation for tooltips and status text. */
  detail: string | null;
}

/** Accept only whole policy versions of 1 or more; anything else is unversioned. */
function sanitizeVersion(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  return value >= 1 ? value : null;
}

/**
 * Snapshot the version of the saved policy governing a run draft.
 * Intended for the moment a draft is created; returns null when no valid
 * saved policy exists.
 */
export function getDraftInstructionVersion(
  policy: Pick<PayrollPolicy, "version"> | null | undefined,
): number | null {
  return sanitizeVersion(policy?.version);
}

export function getInstructionVersionStatus(
  version: number | null | undefined,
  draftVersion: number | null | undefined,
): InstructionVersionStatus {
  const activeVersion = sanitizeVersion(version);
  const snapshottedVersion = sanitizeVersion(draftVersion);

  if (activeVersion === null) {
    return {
      state: "unconfigured",
      version: null,
      draftVersion: snapshottedVersion,
      label: null,
      detail:
        "No saved payroll policy is versioned yet. Save a policy in Payroll Policy to anchor payroll instructions to a version.",
    };
  }

  if (snapshottedVersion === null || snapshottedVersion === activeVersion) {
    return {
      state: "current",
      version: activeVersion,
      draftVersion: snapshottedVersion,
      label: `v${activeVersion}`,
      detail:
        snapshottedVersion === null
          ? `This run follows the currently saved payroll policy version v${activeVersion}.`
          : `This run is governed by the active payroll policy version v${activeVersion}.`,
    };
  }

  const detail =
    snapshottedVersion < activeVersion
      ? `A newer payroll policy (v${activeVersion}) is active; this run was drafted under v${snapshottedVersion}. The run keeps its drafted version — start a new draft to adopt v${activeVersion}.`
      : `This run was drafted under v${snapshottedVersion}, but the currently saved payroll policy is v${activeVersion}. Verify the payroll policy registry before signing.`;

  return {
    state: "stale",
    version: activeVersion,
    draftVersion: snapshottedVersion,
    // The pill shows the version the run is actually governed by.
    label: `v${snapshottedVersion}`,
    detail,
  };
}
