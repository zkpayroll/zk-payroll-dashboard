import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SigningFailureCategory } from "@/lib/wallet/signingErrors";

/**
 * Recovery-center-relevant signing failure categories. `wrong-network` is
 * handled by its own dedicated overlay/flow (see ADMIN_RECOVERY_GUIDE.md)
 * and is intentionally excluded here.
 */
export type RecoverableSigningCategory = Extract<
  SigningFailureCategory,
  "rejected" | "expired-session" | "malformed-transaction" | "unknown"
>;

export interface SigningFailureRecord {
  id: string;
  category: RecoverableSigningCategory;
  message: string;
  /** Short label of the dashboard action that was being signed, e.g. "Submit payroll". */
  action?: string;
  occurredAt: string;
  resolved: boolean;
}

interface SigningFailuresState {
  failures: SigningFailureRecord[];
  recordFailure: (input: {
    category: RecoverableSigningCategory;
    message: string;
    action?: string;
  }) => string;
  resolveFailure: (id: string) => void;
  dismissFailure: (id: string) => void;
  clearAll: () => void;
}

export const useSigningFailuresStore = create<SigningFailuresState>()(
  persist(
    (set, get) => ({
      failures: [],
      recordFailure: ({ category, message, action }) => {
        const id = `signing_failure_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        set({
          failures: [
            {
              id,
              category,
              message,
              action,
              occurredAt: new Date().toISOString(),
              resolved: false,
            },
            ...get().failures,
          ],
        });
        return id;
      },
      resolveFailure: (id) =>
        set({
          failures: get().failures.map((f) => (f.id === id ? { ...f, resolved: true } : f)),
        }),
      dismissFailure: (id) =>
        set({ failures: get().failures.filter((f) => f.id !== id) }),
      clearAll: () => set({ failures: [] }),
    }),
    { name: "zk-payroll-signing-failures" },
  ),
);
