import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DraftStatus = "draft" | "recovering" | "recovered" | "expired" | "discarded";

export interface PayrollDraft {
  id: string;
  name: string;
  employeeIds: string[];
  totalAmount: number;
  payPeriod: string;
  currency: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  lastSavedBy?: string;
  recoveryToken?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type DraftSortField = "updatedAt" | "createdAt" | "expiresAt" | "totalAmount";
export type DraftSortDirection = "asc" | "desc";
export type DraftFilterStatus = "all" | DraftStatus;

interface PayrollDraftsStore {
  drafts: PayrollDraft[];
  activeDraftId: string | null;
  filterStatus: DraftFilterStatus;
  searchQuery: string;
  sortField: DraftSortField;
  sortDirection: DraftSortDirection;

  addDraft: (draft: Omit<PayrollDraft, "id" | "createdAt" | "updatedAt" | "expiresAt" | "status">) => PayrollDraft;
  updateDraft: (id: string, updates: Partial<PayrollDraft>) => void;
  removeDraft: (id: string) => void;
  setActiveDraft: (id: string | null) => void;
  recoverDraft: (id: string) => void;
  discardDraft: (id: string) => void;
  setFilterStatus: (status: DraftFilterStatus) => void;
  setSearchQuery: (query: string) => void;
  setSortField: (field: DraftSortField) => void;
  toggleSortDirection: () => void;
  getFilteredDrafts: () => PayrollDraft[];
  getActiveDraft: () => PayrollDraft | null;
  cleanupExpired: () => void;
  reset: () => void;
}

const EXPIRY_HOURS = 72;

function generateId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const initialState = {
  drafts: [] as PayrollDraft[],
  activeDraftId: null as string | null,
  filterStatus: "all" as DraftFilterStatus,
  searchQuery: "",
  sortField: "updatedAt" as DraftSortField,
  sortDirection: "desc" as DraftSortDirection,
};

export const usePayrollDraftsStore = create<PayrollDraftsStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      addDraft: (draftData) => {
        const now = new Date().toISOString();
        const expiresAt = new Date(
          Date.now() + EXPIRY_HOURS * 60 * 60 * 1000
        ).toISOString();
        const draft: PayrollDraft = {
          ...draftData,
          id: generateId(),
          status: "draft",
          createdAt: now,
          updatedAt: now,
          expiresAt,
        };
        set((state) => ({ drafts: [...state.drafts, draft] }));
        return draft;
      },
      updateDraft: (id, updates) =>
        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id
              ? { ...d, ...updates, updatedAt: new Date().toISOString() }
              : d
          ),
        })),
      removeDraft: (id) =>
        set((state) => ({
          drafts: state.drafts.filter((d) => d.id !== id),
          activeDraftId: state.activeDraftId === id ? null : state.activeDraftId,
        })),
      setActiveDraft: (id) => set({ activeDraftId: id }),
      recoverDraft: (id) =>
        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id
              ? { ...d, status: "recovering" as DraftStatus, updatedAt: new Date().toISOString() }
              : d
          ),
        })),
      discardDraft: (id) =>
        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id
              ? { ...d, status: "discarded" as DraftStatus, updatedAt: new Date().toISOString() }
              : d
          ),
        })),
      setFilterStatus: (filterStatus) => set({ filterStatus }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSortField: (sortField) => set({ sortField }),
      toggleSortDirection: () =>
        set((state) => ({
          sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
        })),
      getFilteredDrafts: () => {
        const { drafts, filterStatus, searchQuery, sortField, sortDirection } = get();
        let filtered = [...drafts];

        if (filterStatus !== "all") {
          filtered = filtered.filter((d) => d.status === filterStatus);
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (d) =>
              d.name.toLowerCase().includes(q) ||
              d.payPeriod.toLowerCase().includes(q) ||
              d.currency.toLowerCase().includes(q)
          );
        }

        filtered.sort((a, b) => {
          const cmp = a[sortField] > b[sortField] ? 1 : a[sortField] < b[sortField] ? -1 : 0;
          return sortDirection === "desc" ? -cmp : cmp;
        });

        return filtered;
      },
      getActiveDraft: () => {
        const { drafts, activeDraftId } = get();
        return drafts.find((d) => d.id === activeDraftId) ?? null;
      },
      cleanupExpired: () =>
        set((state) => ({
          drafts: state.drafts.map((d) => {
            if (d.status !== "draft" && d.status !== "recovering") return d;
            if (new Date(d.expiresAt) < new Date()) {
              return { ...d, status: "expired" as DraftStatus };
            }
            return d;
          }),
        })),
      reset: () => set(initialState),
    }),
    { name: "zk-payroll-drafts" }
  )
);
