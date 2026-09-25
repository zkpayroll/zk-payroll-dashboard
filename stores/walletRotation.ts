import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  WalletRotationRequest,
  WalletRotationEvent,
  WalletRotationCooldown,
  WalletRotationWarning,
  WalletRotationReasonCode,
} from "@/types";

// ─── Helper: mask a Stellar address for display ─────────────────────────────

export function maskAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ─── Helper: build a warning list from rotation state ────────────────────────

function buildWarnings(
  request: WalletRotationRequest | undefined,
  cooldowns: WalletRotationCooldown[],
): WalletRotationWarning[] {
  const warnings: WalletRotationWarning[] = [];
  if (!request) return warnings;

  if (request.status === "pending") {
    warnings.push({
      type: "pending_approval",
      message: "A wallet rotation is awaiting approval.",
      severity: "info",
    });
  }

  if (request.status === "cooldown") {
    const cd = cooldowns.find((c) => c.rotationId === request.id && c.isActive);
    if (cd) {
      warnings.push({
        type: "cooldown_active",
        message: `Wallet rotation cooldown is active until ${new Date(cd.expiresAt).toLocaleString()}. Payroll is blocked during cooldown.`,
        severity: "warning",
      });
    }
  }

  if (request.status === "completed" || request.status === "failed") {
    warnings.push({
      type: "payroll_blocker",
      message:
        request.status === "completed"
          ? "Wallet rotation completed. Payroll can proceed with the new wallet."
          : "Wallet rotation failed. Payroll may be blocked until the issue is resolved.",
      severity: request.status === "failed" ? "critical" : "info",
    });
  }

  return warnings;
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface WalletRotationState {
  requests: WalletRotationRequest[];
  cooldowns: WalletRotationCooldown[];
  isLoading: boolean;

  // Selectors
  getRequestForEmployee: (employeeId: string) => WalletRotationRequest | undefined;
  getEventsForEmployee: (employeeId: string) => WalletRotationEvent[];
  getWarningsForEmployee: (employeeId: string) => WalletRotationWarning[];
  isCooldownActive: (employeeId: string) => boolean;
  hasActiveRotation: (employeeId: string) => boolean;

  // Actions
  addRequest: (request: WalletRotationRequest) => void;
  approveRequest: (requestId: string, approvedBy: string) => void;
  rejectRequest: (requestId: string, rejectedBy: string, reason: string) => void;
  activateCooldown: (requestId: string, employeeId: string, durationMs: number) => void;
  expireCooldown: (requestId: string) => void;
  completeRotation: (requestId: string, newWallet: string) => void;
  failRotation: (requestId: string, error: string) => void;
  addEvent: (requestId: string, event: WalletRotationEvent) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const COOLDOWN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const initialState = {
  requests: [],
  cooldowns: [],
  isLoading: false,
};

export const useWalletRotationStore = create<WalletRotationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      getRequestForEmployee: (employeeId) =>
        get().requests.find((r) => r.employeeId === employeeId),

      getEventsForEmployee: (employeeId) => {
        const request = get().requests.find(
          (r) => r.employeeId === employeeId,
        );
        return request ? [...request.events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
      },

      getWarningsForEmployee: (employeeId) => {
        const request = get().requests.find(
          (r) => r.employeeId === employeeId,
        );
        return buildWarnings(request, get().cooldowns);
      },

      isCooldownActive: (employeeId) =>
        get().cooldowns.some(
          (c) => c.employeeId === employeeId && c.isActive,
        ),

      hasActiveRotation: (employeeId) =>
        get().requests.some(
          (r) =>
            r.employeeId === employeeId &&
            (r.status === "pending" || r.status === "cooldown" || r.status === "approved"),
        ),

      addRequest: (request) =>
        set((state) => ({
          requests: [...state.requests, request],
        })),

      approveRequest: (requestId, approvedBy) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "cooldown" as const,
                  approvedBy,
                  approvedAt: new Date().toISOString(),
                }
              : r,
          ),
        })),

      rejectRequest: (requestId, rejectedBy, reason) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "rejected" as const,
                  approvedBy: rejectedBy,
                  approvedAt: new Date().toISOString(),
                  rejectionReason: reason,
                }
              : r,
          ),
        })),

      activateCooldown: (requestId, employeeId, durationMs) =>
        set((state) => {
          const expiresAt = new Date(Date.now() + durationMs).toISOString();
          return {
            cooldowns: [
              ...state.cooldowns.filter(
                (c) => !(c.employeeId === employeeId && c.isActive),
              ),
              {
                employeeId,
                rotationId: requestId,
                activatedAt: new Date().toISOString(),
                expiresAt,
                isActive: true,
              },
            ],
          };
        }),

      expireCooldown: (requestId) =>
        set((state) => ({
          cooldowns: state.cooldowns.map((c) =>
            c.rotationId === requestId ? { ...c, isActive: false } : c,
          ),
          requests: state.requests.map((r) =>
            r.id === requestId && r.status === "cooldown"
              ? { ...r, status: "approved" as const }
              : r,
          ),
        })),

      completeRotation: (requestId, newWallet) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.id === requestId
              ? { ...r, status: "completed" as const, newWallet }
              : r,
          ),
          cooldowns: state.cooldowns.map((c) =>
            c.rotationId === requestId ? { ...c, isActive: false } : c,
          ),
        })),

      failRotation: (requestId, error) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "failed" as const,
                  metadata: { ...r.metadata, error },
                }
              : r,
          ),
        })),

      addEvent: (requestId, event) =>
        set((state) => ({
          requests: state.requests.map((r) =>
            r.id === requestId
              ? { ...r, events: [...r.events, event] }
              : r,
          ),
        })),

      setLoading: (loading) => set({ isLoading: loading }),

      reset: () => set(initialState),
    }),
    {
      name: "zk-wallet-rotation",
      partialize: (state) => ({
        requests: state.requests,
        cooldowns: state.cooldowns,
      }),
    },
  ),
);

export { COOLDOWN_DURATION_MS };
