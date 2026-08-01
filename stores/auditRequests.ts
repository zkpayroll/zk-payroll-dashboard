import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuditAccessRequest } from "@/types/models";

interface AuditRequestState {
  requests: AuditAccessRequest[];
  addRequest: (request: AuditAccessRequest) => void;
  approveRequest: (id: string, viewKeyId: string) => void;
  rejectRequest: (id: string) => void;
  revokeRequestByViewKey: (viewKeyId: string) => void;
  expireRequestByViewKey: (viewKeyId: string) => void;
  markExportReady: (id: string) => void;
  setRequests: (requests: AuditAccessRequest[]) => void;
}

export const useAuditRequestStore = create<AuditRequestState>()(
  persist(
    (set) => ({
      requests: [],
      addRequest: (request) =>
        set((state) => ({ requests: [...state.requests, request] })),
      approveRequest: (id, viewKeyId) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: "approved",
                  viewKeyId,
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        })),
      rejectRequest: (id) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: "rejected",
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        })),
      revokeRequestByViewKey: (viewKeyId) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.viewKeyId === viewKeyId
              ? {
                  ...r,
                  status: "revoked",
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        })),
      expireRequestByViewKey: (viewKeyId) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.viewKeyId === viewKeyId
              ? {
                  ...r,
                  status: "expired",
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        })),
      markExportReady: (id) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: "export_ready",
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        })),
      setRequests: (requests) => set({ requests }),
    }),
    { name: "zk-payroll-audit-requests" },
  ),
);
