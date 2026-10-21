import { create } from "zustand";
import {
  createPayrollEditSession,
  heartbeatPayrollEditSession,
  evaluateConcurrentPayrollEdits,
  type PayrollEditSession,
  type ConcurrentEditEvaluationResult,
} from "@/src/payroll/concurrentPayrollEditWarning";

export interface PayrollConcurrencyStore {
  sessions: Record<string, PayrollEditSession>;
  remoteVersions: Record<string, { version: number | string; updatedAt?: string; editorId?: string }>;
  peerSessions: Record<string, PayrollEditSession[]>;
  evaluations: Record<string, ConcurrentEditEvaluationResult>;
  dismissedPayrollIds: Record<string, boolean>;

  startSession: (
    payrollId: string,
    operatorId: string,
    baseVersion: number | string,
    clientInstanceId?: string,
    baseUpdatedAt?: string,
  ) => PayrollEditSession;
  heartbeat: (payrollId: string) => void;
  recordRemoteChange: (
    payrollId: string,
    version: number | string,
    updatedAt?: string,
    editorId?: string,
  ) => void;
  setPeerSessions: (payrollId: string, peers: PayrollEditSession[]) => void;
  evaluate: (payrollId: string) => ConcurrentEditEvaluationResult | null;
  releaseSession: (payrollId: string) => void;
  dismissWarning: (payrollId: string) => void;
  reset: () => void;
}

export const usePayrollConcurrencyStore = create<PayrollConcurrencyStore>((set, get) => ({
  sessions: {},
  remoteVersions: {},
  peerSessions: {},
  evaluations: {},
  dismissedPayrollIds: {},

  startSession: (payrollId, operatorId, baseVersion, clientInstanceId, baseUpdatedAt) => {
    const session = createPayrollEditSession(
      payrollId,
      operatorId,
      baseVersion,
      clientInstanceId,
      Date.now(),
      baseUpdatedAt,
    );
    set((state) => {
      const nextSessions = { ...state.sessions, [payrollId]: session };
      const remote = state.remoteVersions[payrollId];
      const peers = state.peerSessions[payrollId] ?? [];

      const evaluation = evaluateConcurrentPayrollEdits({
        payrollId,
        currentSession: session,
        latestRemoteVersion: remote?.version,
        latestRemoteUpdatedAt: remote?.updatedAt,
        latestRemoteEditorId: remote?.editorId,
        activeSessions: peers,
      });

      return {
        sessions: nextSessions,
        evaluations: { ...state.evaluations, [payrollId]: evaluation },
      };
    });
    return session;
  },

  heartbeat: (payrollId) => {
    set((state) => {
      const session = state.sessions[payrollId];
      if (!session) return state;
      const updated = heartbeatPayrollEditSession(session);
      return {
        sessions: { ...state.sessions, [payrollId]: updated },
      };
    });
  },

  recordRemoteChange: (payrollId, version, updatedAt, editorId) => {
    set((state) => {
      const nextRemotes = {
        ...state.remoteVersions,
        [payrollId]: { version, updatedAt, editorId },
      };
      const session = state.sessions[payrollId];
      if (!session) {
        return { remoteVersions: nextRemotes };
      }
      const evaluation = evaluateConcurrentPayrollEdits({
        payrollId,
        currentSession: session,
        latestRemoteVersion: version,
        latestRemoteUpdatedAt: updatedAt,
        latestRemoteEditorId: editorId,
        activeSessions: state.peerSessions[payrollId] ?? [],
      });
      return {
        remoteVersions: nextRemotes,
        evaluations: { ...state.evaluations, [payrollId]: evaluation },
        dismissedPayrollIds: { ...state.dismissedPayrollIds, [payrollId]: false },
      };
    });
  },

  setPeerSessions: (payrollId, peers) => {
    set((state) => {
      const nextPeers = { ...state.peerSessions, [payrollId]: peers };
      const session = state.sessions[payrollId];
      if (!session) {
        return { peerSessions: nextPeers };
      }
      const remote = state.remoteVersions[payrollId];
      const evaluation = evaluateConcurrentPayrollEdits({
        payrollId,
        currentSession: session,
        latestRemoteVersion: remote?.version,
        latestRemoteUpdatedAt: remote?.updatedAt,
        latestRemoteEditorId: remote?.editorId,
        activeSessions: peers,
      });
      return {
        peerSessions: nextPeers,
        evaluations: { ...state.evaluations, [payrollId]: evaluation },
      };
    });
  },

  evaluate: (payrollId) => {
    const state = get();
    const session = state.sessions[payrollId];
    if (!session) return null;
    const remote = state.remoteVersions[payrollId];
    const peers = state.peerSessions[payrollId] ?? [];
    const evaluation = evaluateConcurrentPayrollEdits({
      payrollId,
      currentSession: session,
      latestRemoteVersion: remote?.version,
      latestRemoteUpdatedAt: remote?.updatedAt,
      latestRemoteEditorId: remote?.editorId,
      activeSessions: peers,
    });
    set((s) => ({
      evaluations: { ...s.evaluations, [payrollId]: evaluation },
    }));
    return evaluation;
  },

  releaseSession: (payrollId) => {
    set((state) => {
      const { [payrollId]: _, ...remainingSessions } = state.sessions;
      const { [payrollId]: __, ...remainingEvaluations } = state.evaluations;
      return {
        sessions: remainingSessions,
        evaluations: remainingEvaluations,
      };
    });
  },

  dismissWarning: (payrollId) => {
    set((state) => ({
      dismissedPayrollIds: { ...state.dismissedPayrollIds, [payrollId]: true },
    }));
  },

  reset: () => {
    set({
      sessions: {},
      remoteVersions: {},
      peerSessions: {},
      evaluations: {},
      dismissedPayrollIds: {},
    });
  },
}));
