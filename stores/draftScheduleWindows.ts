import { create } from "zustand";
import type { DraftSettlementWindow } from "@/types/models";
import { findOverlappingWindows, type DateRange } from "@/lib/date/scheduleWindows";
import {
  evaluatePeriodBoundaryRecovery,
  applyPeriodBoundaryRecoveryAction,
} from "@/lib/payroll/periodBoundaryRecovery";
import type {
  PeriodBoundaryRecoveryAction,
  PeriodBoundaryRecoveryPlan,
  PeriodBoundaryRecoveryResult,
} from "@/types/periodBoundary";

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
  recoveryPlan?: PeriodBoundaryRecoveryPlan;
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
  getRecoveryPlan: (input: UpsertDraftWindowInput) => PeriodBoundaryRecoveryPlan;
  applyRecovery: (
    action: PeriodBoundaryRecoveryAction,
    input: UpsertDraftWindowInput,
  ) => PeriodBoundaryRecoveryResult;
  recoverAndUpsertDraft: (
    input: UpsertDraftWindowInput,
    action?: PeriodBoundaryRecoveryAction,
  ) => UpsertDraftWindowResult;
}

export const useDraftScheduleWindowStore = create<DraftScheduleWindowStore>((set, get) => ({
  drafts: [],

  setDrafts: (drafts) => set({ drafts }),

  getRecoveryPlan: (input) => {
    return evaluatePeriodBoundaryRecovery({
      start: input.windowStart,
      end: input.windowEnd,
      templateId: input.templateId,
      existingWindows: get().drafts.map((d) => ({
        id: d.id,
        templateId: d.templateId,
        start: d.windowStart,
        end: d.windowEnd,
      })),
      excludeId: input.id,
    });
  },

  applyRecovery: (action, input) => {
    return applyPeriodBoundaryRecoveryAction(action, {
      start: input.windowStart,
      end: input.windowEnd,
      templateId: input.templateId,
      existingWindows: get().drafts.map((d) => ({
        id: d.id,
        templateId: d.templateId,
        start: d.windowStart,
        end: d.windowEnd,
      })),
      excludeId: input.id,
    });
  },

  recoverAndUpsertDraft: (input, action) => {
    const plan = get().getRecoveryPlan(input);
    const chosenAction = action ?? plan.recommendedAction;

    if (chosenAction === "clear_conflicts") {
      const conflictIds = new Set(plan.conflictingWindows?.map((w) => w.id) ?? []);
      set((state) => ({
        drafts: state.drafts.filter((d) => !conflictIds.has(d.id)),
      }));
      return get().upsertDraft(input);
    }

    const recoveryResult = get().applyRecovery(chosenAction, input);
    if (!recoveryResult.ok || !recoveryResult.recoveredWindow) {
      return {
        success: false,
        window: {
          id: input.id ?? generateDraftId(),
          templateId: input.templateId,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
          createdAt: new Date().toISOString(),
        },
        conflictsWith: plan.conflictingWindows?.map((w) => w.id) ?? [],
        recoveryPlan: plan,
      };
    }

    return get().upsertDraft({
      id: input.id,
      templateId: input.templateId,
      windowStart: recoveryResult.recoveredWindow.start,
      windowEnd: recoveryResult.recoveredWindow.end,
    });
  },

  upsertDraft: (input) => {
    const window: DraftSettlementWindow = {
      id: input.id ?? generateDraftId(),
      templateId: input.templateId,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      createdAt: new Date().toISOString(),
    };

    // A window whose start falls after its end is not a valid range.
    if (input.windowStart > input.windowEnd) {
      const plan = get().getRecoveryPlan(input);
      return { success: false, window, conflictsWith: [], recoveryPlan: plan };
    }

    // Only windows belonging to the *same* template are hard conflicts:
    // two different templates may legitimately target the same settlement
    // period (the schedule editor surfaces that as a collision warning
    // without blocking the draft).
    const candidate: DateRange = { start: input.windowStart, end: input.windowEnd };
    const existingRanges = get()
      .drafts.filter((d) => d.templateId === input.templateId)
      .map((d) => ({
        id: d.id,
        range: { start: d.windowStart, end: d.windowEnd },
      }));

    const overlapCheck = findOverlappingWindows(candidate, existingRanges, input.id);

    if (overlapCheck.hasOverlap) {
      const plan = get().getRecoveryPlan(input);
      return { success: false, window, conflictsWith: overlapCheck.conflictsWith, recoveryPlan: plan };
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

