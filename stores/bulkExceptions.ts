import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ExceptionType = "invalid_wallet" | "inactive_record" | "duplicate_entry";

export type ExceptionStatus = "pending" | "resolved" | "dismissed";

export type ExceptionSeverity = "error" | "warning";

export interface BulkException {
  id: string;
  employeeName: string;
  employeeId?: string;
  email?: string;
  department?: string;
  walletAddress: string;
  exceptionType: ExceptionType;
  severity: ExceptionSeverity;
  description: string;
  detectedAt: string;
  status: ExceptionStatus;
  resolvedAt?: string;
  notes?: string;
}

interface BulkExceptionsState {
  exceptions: BulkException[];
  setExceptions: (exceptions: BulkException[]) => void;
  resolveException: (id: string) => void;
  dismissException: (id: string) => void;
  reopenException: (id: string) => void;
  resolveAll: () => void;
  dismissAll: () => void;
  addNote: (id: string, note: string) => void;
  clearExceptions: () => void;
}

export const useBulkExceptionsStore = create<BulkExceptionsState>()(
  persist(
    (set) => ({
      exceptions: [],

      setExceptions: (exceptions) => set({ exceptions }),

      resolveException: (id) =>
        set((state) => ({
          exceptions: state.exceptions.map((e) =>
            e.id === id
              ? { ...e, status: "resolved" as const, resolvedAt: new Date().toISOString() }
              : e
          ),
        })),

      dismissException: (id) =>
        set((state) => ({
          exceptions: state.exceptions.map((e) =>
            e.id === id ? { ...e, status: "dismissed" as const } : e
          ),
        })),

      reopenException: (id) =>
        set((state) => ({
          exceptions: state.exceptions.map((e) =>
            e.id === id
              ? { ...e, status: "pending" as const, resolvedAt: undefined }
              : e
          ),
        })),

      resolveAll: () =>
        set((state) => ({
          exceptions: state.exceptions.map((e) =>
            e.status === "pending"
              ? { ...e, status: "resolved" as const, resolvedAt: new Date().toISOString() }
              : e
          ),
        })),

      dismissAll: () =>
        set((state) => ({
          exceptions: state.exceptions.map((e) =>
            e.status === "pending" ? { ...e, status: "dismissed" as const } : e
          ),
        })),

      addNote: (id, note) =>
        set((state) => ({
          exceptions: state.exceptions.map((e) =>
            e.id === id ? { ...e, notes: note } : e
          ),
        })),

      clearExceptions: () => set({ exceptions: [] }),
    }),
    { name: "zk-payroll-bulk-exceptions" }
  )
);
