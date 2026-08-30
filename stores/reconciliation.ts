"use client";

import { create } from "zustand";

export type BatchRootMatchStatus = "match" | "mismatch" | "pending" | "missing";

export interface BatchRootComparisonState {
  expectedRoot: string | null;
  observedRoot: string | null;
  status: BatchRootMatchStatus;
  eventSource: string | null;
  eventReference: string | null;
  mismatchReason: string | null;
  lastUpdated: number | null;
  setExpectedRoot: (root: string) => void;
  setObservedRoot: (root: string) => void;
  setStatus: (status: BatchRootMatchStatus) => void;
  setEventSource: (source: string) => void;
  setEventReference: (reference: string) => void;
  setMismatchReason: (reason: string | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  expectedRoot: null,
  observedRoot: null,
  status: "pending" as BatchRootMatchStatus,
  eventSource: null,
  eventReference: null,
  mismatchReason: null,
  lastUpdated: null,
};

export const useReconciliationStore = create<BatchRootComparisonState>((set) => ({
  ...INITIAL_STATE,
  setExpectedRoot: (expectedRoot: string) =>
    set({ expectedRoot, lastUpdated: Date.now() }),
  setObservedRoot: (observedRoot: string) =>
    set({ observedRoot, lastUpdated: Date.now() }),
  setStatus: (status: BatchRootMatchStatus) =>
    set({ status, lastUpdated: Date.now() }),
  setEventSource: (eventSource: string) =>
    set({ eventSource, lastUpdated: Date.now() }),
  setEventReference: (eventReference: string) =>
    set({ eventReference, lastUpdated: Date.now() }),
  setMismatchReason: (mismatchReason: string | null) =>
    set({ mismatchReason, lastUpdated: Date.now() }),
  reset: () => set({ ...INITIAL_STATE }),
}));

export function computeBatchRootStatus(
  expectedRoot: string | null,
  observedRoot: string | null
): BatchRootMatchStatus {
  if (!expectedRoot && !observedRoot) return "missing";
  if (!expectedRoot || !observedRoot) return "pending";
  return expectedRoot === observedRoot ? "match" : "mismatch";
}

export function getMismatchReason(
  expectedRoot: string | null,
  observedRoot: string | null
): string | null {
  if (!expectedRoot && !observedRoot) return null;
  if (!expectedRoot) return "Expected root not available — batch commitment was not recorded";
  if (!observedRoot) return "Observed root not available — on-chain event not yet received";
  if (expectedRoot.length !== observedRoot.length) return "Root length differs — structural mismatch";
  return "Root hash differs — batch commitment does not match on-chain record";
}