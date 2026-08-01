import { create } from "zustand";
import type { ApprovalEvent, ApprovalEventType } from "@/types";

interface ApprovalHistoryStore {
  events: ApprovalEvent[];
  addEvent: (
    type: ApprovalEventType,
    actor: string,
    details: string,
    metadata?: Record<string, unknown>,
  ) => void;
  clearHistory: () => void;
}

export const useApprovalHistory = create<ApprovalHistoryStore>((set) => ({
  events: [],
  addEvent: (type, actor, details, metadata) =>
    set((state) => ({
      events: [
        {
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          type,
          timestamp: new Date().toISOString(),
          actor,
          details,
          metadata,
        },
        ...state.events,
      ],
    })),
  clearHistory: () => set({ events: [] }),
}));