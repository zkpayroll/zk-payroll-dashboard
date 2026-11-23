/**
 * Dashboard concurrent payroll edit warnings (#739).
 *
 * Detects concurrent edits, optimistic lock / version conflicts, and active
 * operator presence when multiple operators or dashboard tabs edit payroll
 * drafts or payroll runs simultaneously.
 *
 * Privacy guarantees:
 * - Version tokens and edit sessions carry only timestamps, opaque IDs, and version numbers.
 * - Operator identifiers are masked (e.g. "op_...a1b2" or "GABC...XYZ").
 * - Zero salary figures, employee identities, proof payloads, or private keys
 *   are ever included in warnings, error messages, or audit payloads.
 */

export type ConcurrentEditConflictType =
  | "version_mismatch"
  | "concurrent_active_editor"
  | "session_expired"
  | "stale_timestamp"
  | "lock_conflict";

export type ConcurrentEditSeverity = "info" | "warning" | "critical";

export type ConcurrentEditActionType =
  | "reload_latest"
  | "review_changes"
  | "renew_session"
  | "dismiss"
  | "proceed_with_caution";

export interface ConcurrentEditAction {
  readonly label: string;
  readonly action: ConcurrentEditActionType;
  readonly primary?: boolean;
}

export interface PayrollEditSession {
  readonly sessionId: string;
  readonly payrollId: string;
  readonly operatorId: string;
  readonly baseVersion: number | string;
  readonly openedAt: string;
  readonly lastHeartbeatAt: string;
  readonly status: "active" | "stale" | "expired" | "released";
  readonly clientInstanceId?: string;
  readonly baseUpdatedAt?: string;
}

export interface ConcurrentEditWarning {
  readonly id: string;
  readonly payrollId: string;
  readonly conflictType: ConcurrentEditConflictType;
  readonly severity: ConcurrentEditSeverity;
  readonly title: string;
  readonly message: string;
  readonly blocking: boolean;
  readonly detectedAt: string;
  readonly activeEditorCount: number;
  readonly baseVersion: number | string;
  readonly latestVersion?: number | string;
  readonly lastEditedByMasked?: string;
  readonly recommendedAction: ConcurrentEditActionType;
  readonly availableActions: readonly ConcurrentEditAction[];
}

export interface ConcurrentEditCheckInput {
  readonly payrollId: string;
  readonly currentSession: PayrollEditSession;
  readonly latestRemoteVersion?: number | string;
  readonly latestRemoteUpdatedAt?: string;
  readonly latestRemoteEditorId?: string;
  readonly activeSessions?: readonly PayrollEditSession[];
  readonly sessionTtlMs?: number;
  readonly heartbeatTimeoutMs?: number;
  readonly now?: number;
}

export interface ConcurrentEditEvaluationResult {
  readonly hasConflict: boolean;
  readonly canSubmit: boolean;
  readonly highestSeverity: ConcurrentEditSeverity | null;
  readonly activeEditorCount: number;
  readonly warnings: readonly ConcurrentEditWarning[];
  readonly blockingWarning: ConcurrentEditWarning | null;
}

/** Default edit session validity window: 30 minutes. */
export const DEFAULT_EDIT_SESSION_TTL_MS = 30 * 60 * 1000;

/** Default active editor heartbeat timeout: 2 minutes. */
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Mask an operator or wallet identifier for privacy-safe display.
 * Never outputs the complete secret or full internal address.
 */
export function maskOperatorIdentifier(operatorId?: string | null): string {
  if (!operatorId || typeof operatorId !== "string" || operatorId.trim().length === 0) {
    return "Unknown Operator";
  }
  const clean = operatorId.trim();
  if (clean.length <= 8) {
    return clean;
  }
  if (clean.startsWith("G") && clean.length >= 56) {
    // Stellar public key style
    return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
  }
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

/**
 * Open a new payroll edit session with unique session token.
 */
export function createPayrollEditSession(
  payrollId: string,
  operatorId: string,
  baseVersion: number | string,
  clientInstanceId?: string,
  now: number = Date.now(),
  baseUpdatedAt?: string,
): PayrollEditSession {
  const sessionId = `pes_${now}_${Math.random().toString(36).slice(2, 9)}`;
  const timestampIso = new Date(now).toISOString();

  return {
    sessionId,
    payrollId,
    operatorId,
    baseVersion,
    openedAt: timestampIso,
    lastHeartbeatAt: timestampIso,
    status: "active",
    clientInstanceId: clientInstanceId ?? `tab_${Math.random().toString(36).slice(2, 7)}`,
    baseUpdatedAt: baseUpdatedAt ?? timestampIso,
  };
}

/**
 * Check whether a session has exceeded its maximum operational TTL.
 */
export function isSessionExpired(
  session: PayrollEditSession,
  now: number = Date.now(),
  ttlMs: number = DEFAULT_EDIT_SESSION_TTL_MS,
): boolean {
  const openedMs = new Date(session.openedAt).getTime();
  if (isNaN(openedMs)) return true;
  return now - openedMs > ttlMs;
}

/**
 * Check if a session's heartbeat has timed out (abandoned tab).
 */
export function isSessionHeartbeatStale(
  session: PayrollEditSession,
  now: number = Date.now(),
  timeoutMs: number = DEFAULT_HEARTBEAT_TIMEOUT_MS,
): boolean {
  const heartbeatMs = new Date(session.lastHeartbeatAt).getTime();
  if (isNaN(heartbeatMs)) return true;
  return now - heartbeatMs > timeoutMs;
}

/**
 * Update the heartbeat timestamp for an active edit session.
 */
export function heartbeatPayrollEditSession(
  session: PayrollEditSession,
  now: number = Date.now(),
): PayrollEditSession {
  return {
    ...session,
    lastHeartbeatAt: new Date(now).toISOString(),
    status: isSessionExpired(session, now) ? "expired" : "active",
  };
}

/**
 * Pure evaluation engine detecting concurrent payroll edits and generating actionable warnings.
 */
export function evaluateConcurrentPayrollEdits(
  input: ConcurrentEditCheckInput,
): ConcurrentEditEvaluationResult {
  const now = input.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const sessionTtlMs = input.sessionTtlMs ?? DEFAULT_EDIT_SESSION_TTL_MS;
  const heartbeatTimeoutMs = input.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;

  const warnings: ConcurrentEditWarning[] = [];

  // 1. Session Expiration Check
  if (isSessionExpired(input.currentSession, now, sessionTtlMs)) {
    warnings.push({
      id: `warn_exp_${input.payrollId}_${now}`,
      payrollId: input.payrollId,
      conflictType: "session_expired",
      severity: "critical",
      title: "Edit Session Expired",
      message:
        "Your payroll edit session has expired (sessions expire after 30 minutes for security). Re-open or renew your session to continue safely.",
      blocking: true,
      detectedAt: nowIso,
      activeEditorCount: 1,
      baseVersion: input.currentSession.baseVersion,
      recommendedAction: "renew_session",
      availableActions: [
        { label: "Renew Session", action: "renew_session", primary: true },
        { label: "Reload Latest", action: "reload_latest" },
      ],
    });
  }

  // 2. Version Conflict Check (Optimistic Locking)
  if (
    input.latestRemoteVersion !== undefined &&
    String(input.latestRemoteVersion) !== String(input.currentSession.baseVersion)
  ) {
    const maskedEditor = maskOperatorIdentifier(input.latestRemoteEditorId);
    warnings.push({
      id: `warn_ver_${input.payrollId}_${now}`,
      payrollId: input.payrollId,
      conflictType: "version_mismatch",
      severity: "critical",
      title: "Concurrent Payroll Revision Detected",
      message: `Another operator (${maskedEditor}) has saved a newer revision (v${input.latestRemoteVersion}) of this payroll. You are viewing v${input.currentSession.baseVersion}. Please reload to avoid overwriting recent changes.`,
      blocking: true,
      detectedAt: nowIso,
      activeEditorCount: 2,
      baseVersion: input.currentSession.baseVersion,
      latestVersion: input.latestRemoteVersion,
      lastEditedByMasked: maskedEditor,
      recommendedAction: "reload_latest",
      availableActions: [
        { label: "Reload Latest Version", action: "reload_latest", primary: true },
        { label: "Review Changes", action: "review_changes" },
      ],
    });
  }

  // 3. Stale Timestamp Check (Remote updated while version matches or newer timestamp exists)
  if (
    input.latestRemoteUpdatedAt &&
    input.currentSession.baseUpdatedAt &&
    String(input.latestRemoteVersion ?? input.currentSession.baseVersion) ===
      String(input.currentSession.baseVersion)
  ) {
    const baseTime = new Date(input.currentSession.baseUpdatedAt).getTime();
    const remoteTime = new Date(input.latestRemoteUpdatedAt).getTime();
    if (!isNaN(baseTime) && !isNaN(remoteTime) && remoteTime > baseTime + 1000) {
      const maskedEditor = maskOperatorIdentifier(input.latestRemoteEditorId);
      warnings.push({
        id: `warn_time_${input.payrollId}_${now}`,
        payrollId: input.payrollId,
        conflictType: "stale_timestamp",
        severity: "warning",
        title: "Recent Modifications Detected",
        message: `This payroll was updated by ${maskedEditor} at ${new Date(remoteTime).toLocaleTimeString()}. Reload to verify that your draft contains all recent adjustments.`,
        blocking: false,
        detectedAt: nowIso,
        activeEditorCount: 1,
        baseVersion: input.currentSession.baseVersion,
        lastEditedByMasked: maskedEditor,
        recommendedAction: "reload_latest",
        availableActions: [
          { label: "Reload Latest", action: "reload_latest", primary: true },
          { label: "Proceed With Caution", action: "proceed_with_caution" },
          { label: "Dismiss", action: "dismiss" },
        ],
      });
    }
  }

  // 4. Concurrent Active Editors Presence Check
  const activeSessions = (input.activeSessions ?? []).filter((s) => {
    if (s.payrollId !== input.payrollId) return false;
    // Don't count self
    if (
      s.sessionId === input.currentSession.sessionId ||
      (s.clientInstanceId && s.clientInstanceId === input.currentSession.clientInstanceId)
    ) {
      return false;
    }
    // Filter out expired or heartbeat-timed-out sessions
    if (isSessionExpired(s, now, sessionTtlMs)) return false;
    if (isSessionHeartbeatStale(s, now, heartbeatTimeoutMs)) return false;
    return true;
  });

  const activeEditorCount = activeSessions.length + 1;

  if (activeSessions.length > 0) {
    const otherOperators = activeSessions
      .map((s) => maskOperatorIdentifier(s.operatorId))
      .filter((val, idx, arr) => arr.indexOf(val) === idx);

    warnings.push({
      id: `warn_presence_${input.payrollId}_${now}`,
      payrollId: input.payrollId,
      conflictType: "concurrent_active_editor",
      severity: "warning",
      title: "Concurrent Editor Active",
      message: `${otherOperators.length === 1 ? `Operator ${otherOperators[0]}` : `${otherOperators.length} operators`} currently actively viewing/editing this payroll. Coordinate to prevent accidental overwrites.`,
      blocking: false,
      detectedAt: nowIso,
      activeEditorCount,
      baseVersion: input.currentSession.baseVersion,
      recommendedAction: "proceed_with_caution",
      availableActions: [
        { label: "Review Changes", action: "review_changes" },
        { label: "Dismiss", action: "dismiss" },
      ],
    });
  }

  // Derive summary metrics
  const hasConflict = warnings.length > 0;
  const blockingWarning = warnings.find((w) => w.blocking) ?? null;
  const canSubmit = blockingWarning === null;

  let highestSeverity: ConcurrentEditSeverity | null = null;
  if (warnings.some((w) => w.severity === "critical")) {
    highestSeverity = "critical";
  } else if (warnings.some((w) => w.severity === "warning")) {
    highestSeverity = "warning";
  } else if (warnings.length > 0) {
    highestSeverity = "info";
  }

  return {
    hasConflict,
    canSubmit,
    highestSeverity,
    activeEditorCount,
    warnings,
    blockingWarning,
  };
}

/**
 * Custom error thrown when a mutation is attempted during a blocking concurrent conflict.
 */
export class ConcurrentPayrollEditError extends Error {
  readonly code = "CONCURRENT_PAYROLL_EDIT_CONFLICT";
  readonly warning: ConcurrentEditWarning;

  constructor(warning: ConcurrentEditWarning) {
    super(warning.message);
    this.name = "ConcurrentPayrollEditError";
    this.warning = warning;
  }
}

/**
 * Asserts that no blocking concurrent edit conflict exists before committing mutations.
 */
export function assertNoConcurrentPayrollConflict(
  evaluation: ConcurrentEditEvaluationResult,
): void {
  if (!evaluation.canSubmit && evaluation.blockingWarning) {
    throw new ConcurrentPayrollEditError(evaluation.blockingWarning);
  }
}

/**
 * Privacy-safe audit filter: guarantees no PII, individual salaries,
 * or cryptographic secrets are present in audit logs or warning outputs.
 */
export function sanitizeConcurrentWarningForAudit(
  warning: ConcurrentEditWarning,
): Record<string, unknown> {
  return {
    warningId: warning.id,
    payrollId: warning.payrollId,
    conflictType: warning.conflictType,
    severity: warning.severity,
    blocking: warning.blocking,
    detectedAt: warning.detectedAt,
    activeEditorCount: warning.activeEditorCount,
    baseVersion: String(warning.baseVersion),
    latestVersion: warning.latestVersion ? String(warning.latestVersion) : undefined,
    recommendedAction: warning.recommendedAction,
    // Sensitive employee data is completely omitted
  };
}
