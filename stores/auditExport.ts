import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ExportFormat = "csv" | "json" | "pdf";
export type WizardStep = "select" | "review" | "configure" | "export" | "complete";
export type ExportStatus = "idle" | "preparing" | "exporting" | "complete" | "failed";

export interface AuditPacketEntry {
  id: string;
  type: "payroll_run" | "transaction" | "compliance_event" | "key_access_log" | "treasury_movement";
  title: string;
  date: string;
  summary: string;
  selected: boolean;
  fields: string[];
  metadata?: Record<string, unknown>;
}

export interface ExportJob {
  id: string;
  status: ExportStatus;
  format: ExportFormat;
  entries: string[];
  progress: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
  downloadUrl?: string;
  fileSize?: number;
  recordCount: number;
}

interface AuditExportStore {
  entries: AuditPacketEntry[];
  currentStep: WizardStep;
  exportFormat: ExportFormat;
  includeMetadata: boolean;
  dateRangeStart: string;
  dateRangeEnd: string;
  searchQuery: string;
  activeExportJob: ExportJob | null;
  exportHistory: ExportJob[];

  setEntries: (entries: AuditPacketEntry[]) => void;
  toggleEntry: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setCurrentStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setExportFormat: (format: ExportFormat) => void;
  setIncludeMetadata: (include: boolean) => void;
  setDateRange: (start: string, end: string) => void;
  startExport: () => void;
  updateExportProgress: (progress: number) => void;
  completeExport: (downloadUrl: string, fileSize: number) => void;
  failExport: (error: string) => void;
  getSelectedEntries: () => AuditPacketEntry[];
  getFilteredEntries: (type?: AuditPacketEntry["type"]) => AuditPacketEntry[];
  setSearchQuery: (query: string) => void;
  reset: () => void;
}

const STEPS: WizardStep[] = ["select", "review", "configure", "export", "complete"];

const initialState = {
  entries: [] as AuditPacketEntry[],
  currentStep: "select" as WizardStep,
  exportFormat: "csv" as ExportFormat,
  includeMetadata: true,
  dateRangeStart: "",
  dateRangeEnd: "",
  activeExportJob: null as ExportJob | null,
  exportHistory: [] as ExportJob[],
  searchQuery: "",
};

export const useAuditExportStore = create<AuditExportStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setEntries: (entries) => set({ entries }),
      toggleEntry: (id) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, selected: !e.selected } : e
          ),
        })),
      selectAll: () =>
        set((state) => ({
          entries: state.entries.map((e) => ({ ...e, selected: true })),
        })),
      deselectAll: () =>
        set((state) => ({
          entries: state.entries.map((e) => ({ ...e, selected: false })),
        })),
      setCurrentStep: (currentStep) => set({ currentStep }),
      nextStep: () =>
        set((state) => {
          const idx = STEPS.indexOf(state.currentStep);
          if (idx < STEPS.length - 1) {
            return { currentStep: STEPS[idx + 1] };
          }
          return {};
        }),
      prevStep: () =>
        set((state) => {
          const idx = STEPS.indexOf(state.currentStep);
          if (idx > 0) {
            return { currentStep: STEPS[idx - 1] };
          }
          return {};
        }),
      setExportFormat: (exportFormat) => set({ exportFormat }),
      setIncludeMetadata: (includeMetadata) => set({ includeMetadata }),
      setDateRange: (dateRangeStart, dateRangeEnd) =>
        set({ dateRangeStart, dateRangeEnd }),
      startExport: () => {
        const { entries, exportFormat, includeMetadata } = get();
        const selected = entries.filter((e) => e.selected);
        const job: ExportJob = {
          id: `export_${Date.now()}`,
          status: "preparing",
          format: exportFormat,
          entries: selected.map((e) => e.id),
          progress: 0,
          createdAt: new Date().toISOString(),
          recordCount: selected.length,
        };
        set((state) => ({
          activeExportJob: job,
          exportHistory: [...state.exportHistory, job],
        }));
      },
      updateExportProgress: (progress) =>
        set((state) => {
          if (!state.activeExportJob) return {};
          const updated = { ...state.activeExportJob, progress, status: "exporting" as ExportStatus };
          return {
            activeExportJob: updated,
            exportHistory: state.exportHistory.map((j) =>
              j.id === updated.id ? updated : j
            ),
          };
        }),
      completeExport: (downloadUrl, fileSize) =>
        set((state) => {
          if (!state.activeExportJob) return {};
          const updated: ExportJob = {
            ...state.activeExportJob,
            status: "complete",
            progress: 100,
            completedAt: new Date().toISOString(),
            downloadUrl,
            fileSize,
          };
          return {
            activeExportJob: updated,
            currentStep: "complete",
            exportHistory: state.exportHistory.map((j) =>
              j.id === updated.id ? updated : j
            ),
          };
        }),
      failExport: (error) =>
        set((state) => {
          if (!state.activeExportJob) return {};
          const updated: ExportJob = {
            ...state.activeExportJob,
            status: "failed",
            error,
          };
          return {
            activeExportJob: updated,
            exportHistory: state.exportHistory.map((j) =>
              j.id === updated.id ? updated : j
            ),
          };
        }),
      getSelectedEntries: () => get().entries.filter((e) => e.selected),
      getFilteredEntries: (type) => {
        const { entries } = get();
        if (!type) return entries;
        return entries.filter((e) => e.type === type);
      },
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      reset: () => set(initialState),
    }),
    { name: "zk-payroll-audit-export" }
  )
);
