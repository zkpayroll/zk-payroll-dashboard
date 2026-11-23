"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  createPayrollEditSession,
  heartbeatPayrollEditSession,
  evaluateConcurrentPayrollEdits,
  assertNoConcurrentPayrollConflict,
  type PayrollEditSession,
  type ConcurrentEditEvaluationResult,
  type ConcurrentEditWarning,
  DEFAULT_HEARTBEAT_TIMEOUT_MS,
} from "@/src/payroll/concurrentPayrollEditWarning";

export interface UseConcurrentPayrollEditOptions {
  readonly payrollId: string;
  readonly operatorId: string;
  readonly baseVersion: number | string;
  readonly baseUpdatedAt?: string;
  readonly latestRemoteVersion?: number | string;
  readonly latestRemoteUpdatedAt?: string;
  readonly latestRemoteEditorId?: string;
  readonly activeSessions?: readonly PayrollEditSession[];
  readonly sessionTtlMs?: number;
  readonly onReloadLatest?: () => Promise<void> | void;
}

export interface UseConcurrentPayrollEditReturn {
  readonly session: PayrollEditSession;
  readonly evaluation: ConcurrentEditEvaluationResult;
  readonly isBlocked: boolean;
  readonly warnings: readonly ConcurrentEditWarning[];
  readonly activeEditorCount: number;
  readonly reloadLatest: () => Promise<void>;
  readonly renewSession: () => void;
  readonly assertCanSubmit: () => void;
}

export function useConcurrentPayrollEdit({
  payrollId,
  operatorId,
  baseVersion,
  baseUpdatedAt,
  latestRemoteVersion,
  latestRemoteUpdatedAt,
  latestRemoteEditorId,
  activeSessions,
  sessionTtlMs,
  onReloadLatest,
}: UseConcurrentPayrollEditOptions): UseConcurrentPayrollEditReturn {
  const [session, setSession] = useState<PayrollEditSession>(() =>
    createPayrollEditSession(payrollId, operatorId, baseVersion, undefined, Date.now(), baseUpdatedAt),
  );

  // Sync session if payrollId or baseVersion changes (e.g. after reload)
  useEffect(() => {
    setSession((prev) => {
      if (prev.payrollId !== payrollId || prev.baseVersion !== baseVersion) {
        return createPayrollEditSession(payrollId, operatorId, baseVersion, prev.clientInstanceId, Date.now(), baseUpdatedAt);
      }
      return prev;
    });
  }, [payrollId, operatorId, baseVersion, baseUpdatedAt]);

  // Heartbeat interval
  useEffect(() => {
    const interval = setInterval(() => {
      setSession((prev) => heartbeatPayrollEditSession(prev));
    }, Math.floor(DEFAULT_HEARTBEAT_TIMEOUT_MS / 2));

    return () => clearInterval(interval);
  }, []);

  const evaluation = useMemo<ConcurrentEditEvaluationResult>(() => {
    return evaluateConcurrentPayrollEdits({
      payrollId,
      currentSession: session,
      latestRemoteVersion,
      latestRemoteUpdatedAt,
      latestRemoteEditorId,
      activeSessions,
      sessionTtlMs,
    });
  }, [
    payrollId,
    session,
    latestRemoteVersion,
    latestRemoteUpdatedAt,
    latestRemoteEditorId,
    activeSessions,
    sessionTtlMs,
  ]);

  const reloadLatest = useCallback(async () => {
    if (onReloadLatest) {
      await onReloadLatest();
    }
    if (latestRemoteVersion !== undefined) {
      setSession((prev) =>
        createPayrollEditSession(
          payrollId,
          operatorId,
          latestRemoteVersion,
          prev.clientInstanceId,
          Date.now(),
          latestRemoteUpdatedAt,
        ),
      );
    }
  }, [onReloadLatest, latestRemoteVersion, latestRemoteUpdatedAt, payrollId, operatorId]);

  const renewSession = useCallback(() => {
    setSession((prev) =>
      createPayrollEditSession(
        payrollId,
        operatorId,
        latestRemoteVersion ?? baseVersion,
        prev.clientInstanceId,
        Date.now(),
        latestRemoteUpdatedAt ?? baseUpdatedAt,
      ),
    );
  }, [payrollId, operatorId, latestRemoteVersion, baseVersion, latestRemoteUpdatedAt, baseUpdatedAt]);

  const assertCanSubmit = useCallback(() => {
    assertNoConcurrentPayrollConflict(evaluation);
  }, [evaluation]);

  return {
    session,
    evaluation,
    isBlocked: !evaluation.canSubmit,
    warnings: evaluation.warnings,
    activeEditorCount: evaluation.activeEditorCount,
    reloadLatest,
    renewSession,
    assertCanSubmit,
  };
}
