import { create } from "zustand";
import type { DraftSettlementWindow } from "@/types/models";
import { findOverlappingWindows, type DateRange } from "@/lib/date/scheduleWindows";

export interface UpsertDraftWindowInput {
  id?: string;
  templateId: string;
  windowStart: string;
  windowEnd: string;
}

export interface UpsertDraftWindowResult {
  success: boolean;
  window: DraftSettlementWindow;
  conflictsWith: string[];
}

function generateDraftId(): string {
  return `dsw_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface DraftScheduleWindowStore {
  drafts: DraftSettlementWindow[];
  setDrafts: (drafts: DraftSettlementWindow[]) => void;
  upsertDraft: (input: UpsertDraftWindowInput) => UpsertDraftWindowResult;
  removeDraft: (id: string) => void;
  clearDrafts: () => void;
  getDraftsForTemplate: (templateId: string) => DraftSettlementWindow[];
}

export const useDraftScheduleWindowStore = create<DraftScheduleWindowStore>((set, get) => ({
  drafts: [],

  setDrafts: (drafts) => set({ drafts }),

  upsertDraft: (input) => {
    const candidate: DateRange = { start: input.windowStart, end: input.windowEnd };
    const existingRanges = get().drafts.map((d) => ({
      id: d.id,
      range: { start: d.windowStart, end: d.windowEnd },
    }));

    const overlapCheck = findOverlappingWindows(candidate, existingRanges, input.id);

    const window: DraftSettlementWindow = {
      id: input.id ?? generateDraftId(),
      templateId: input.templateId,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      createdAt: new Date().toISOString(),
    };

    if (overlapCheck.hasOverlap) {
      return { success: false, window, conflictsWith: overlapCheck.conflictsWith };
    }

    set((state) => {
      const withoutExisting = state.drafts.filter((d) => d.id !== window.id);
      return { drafts: [...withoutExisting, window] };
    });

    return { success: true, window, conflictsWith: [] };
  },

  removeDraft: (id) => {
    set((state) => ({ drafts: state.drafts.filter((d) => d.id !== id) }));
  },

  clearDrafts: () => set({ drafts: [] }),

  getDraftsForTemplate: (templateId) => {
    return get().drafts.filter((d) => d.templateId === templateId);
  },
}));
