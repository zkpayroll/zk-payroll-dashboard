"use client";

import { useState, useCallback, useMemo, useEffect } from "react";

export interface PeriodSnapshot {
  id: string;
  updatedAt?: string | null;
  status?: string;
  version?: number;
  lastEditedBy?: string;
  employeeCount?: number;
}

export interface ConflictDetails {
  periodId: string;
  remoteUpdatedAt: string | null;
  remoteStatus?: string;
  remoteEditor?: string;
  baseUpdatedAt: string | null;
  baseStatus?: string;
  changeDescription: string;
}

export interface UsePayrollConflictWarningOptions {
  /** The base snapshot when the user loaded the period or began editing. */
  baseSnapshot: PeriodSnapshot | null;
  /** The latest known remote snapshot (from polling, websocket, or API check). */
  remoteSnapshot: PeriodSnapshot | null;
  /** Callback to reload the latest remote data. */
  onReloadLatest?: () => Promise<void> | void;
  /** Callback if operator explicitly chooses to overwrite. */
  onOverwrite?: () => Promise<void> | void;
}

export interface PayrollConflictWarningState {
  hasConflict: boolean;
  conflictDetails: ConflictDetails | null;
  isResolving: boolean;
  error: string | null;
  resolveWithRemote: () => Promise<boolean>;
  confirmOverwrite: () => Promise<boolean>;
  dismissConflict: () => void;
  isDismissed: boolean;
}

export function detectPeriodConflict(
  base: PeriodSnapshot | null,
  remote: PeriodSnapshot | null,
): ConflictDetails | null {
  if (!base || !remote) return null;
  if (base.id !== remote.id) return null;

  // 1. Status transition conflict (e.g., period was finalized, closed, or cancelled remotely)
  if (base.status && remote.status && base.status !== remote.status) {
    return {
      periodId: base.id,
      remoteUpdatedAt: remote.updatedAt ?? null,
      remoteStatus: remote.status,
      remoteEditor: remote.lastEditedBy,
      baseUpdatedAt: base.updatedAt ?? null,
      baseStatus: base.status,
      changeDescription: `Period status changed from "${base.status}" to "${remote.status}" by another process.`,
    };
  }

  // 2. Version conflict
  if (
    base.version !== undefined &&
    remote.version !== undefined &&
    remote.version > base.version
  ) {
    return {
      periodId: base.id,
      remoteUpdatedAt: remote.updatedAt ?? null,
      remoteStatus: remote.status,
      remoteEditor: remote.lastEditedBy,
      baseUpdatedAt: base.updatedAt ?? null,
      baseStatus: base.status,
      changeDescription: `A newer revision (v${remote.version}) was published elsewhere.`,
    };
  }

  // 3. Timestamp conflict
  if (base.updatedAt && remote.updatedAt) {
    const baseTime = new Date(base.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();

    if (!isNaN(baseTime) && !isNaN(remoteTime) && remoteTime > baseTime) {
      const editorStr = remote.lastEditedBy ? ` by ${remote.lastEditedBy}` : "";
      return {
        periodId: base.id,
        remoteUpdatedAt: remote.updatedAt,
        remoteStatus: remote.status,
        remoteEditor: remote.lastEditedBy,
        baseUpdatedAt: base.updatedAt,
        baseStatus: base.status,
        changeDescription: `Period was modified elsewhere${editorStr} at ${new Date(remote.updatedAt).toLocaleTimeString()}.`,
      };
    }
  }

  return null;
}

export function usePayrollConflictWarning({
  baseSnapshot,
  remoteSnapshot,
  onReloadLatest,
  onOverwrite,
}: UsePayrollConflictWarningOptions): PayrollConflictWarningState {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conflictDetails = useMemo(
    () => detectPeriodConflict(baseSnapshot, remoteSnapshot),
    [baseSnapshot, remoteSnapshot],
  );

  // Re-arm warning if new remote changes arrive
  useEffect(() => {
    setIsDismissed(false);
    setError(null);
  }, [remoteSnapshot?.updatedAt, remoteSnapshot?.status, remoteSnapshot?.version]);

  const hasConflict = Boolean(conflictDetails) && !isDismissed;

  const resolveWithRemote = useCallback(async (): Promise<boolean> => {
    setIsResolving(true);
    setError(null);
    try {
      if (onReloadLatest) {
        await onReloadLatest();
      }
      setIsDismissed(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reload latest period data.";
      setError(msg);
      return false;
    } finally {
      setIsResolving(false);
    }
  }, [onReloadLatest]);

  const confirmOverwrite = useCallback(async (): Promise<boolean> => {
    setIsResolving(true);
    setError(null);
    try {
      if (onOverwrite) {
        await onOverwrite();
      }
      setIsDismissed(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to overwrite changes.";
      setError(msg);
      return false;
    } finally {
      setIsResolving(false);
    }
  }, [onOverwrite]);

  const dismissConflict = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return {
    hasConflict,
    conflictDetails,
    isResolving,
    error,
    resolveWithRemote,
    confirmOverwrite,
    dismissConflict,
    isDismissed,
  };
}
