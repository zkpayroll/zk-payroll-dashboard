import { create } from "zustand";
import { persist } from "zustand/middleware";
import { validateReserveRelease } from "@/lib/treasury/reserveReleaseValidation";

export type AssetCode = string;

export interface PayrollObligation {
  id: string;
  name: string;
  amount: number;
  assetCode: AssetCode;
  scheduledDate: string;
  lockedAt: string;
}

export interface TreasuryBalance {
  assetCode: AssetCode;
  available: number;
  reserved: number;
  projected: number;
}

interface TreasuryStore {
  balances: Record<AssetCode, TreasuryBalance>;
  obligations: PayrollObligation[];
  lastUpdated: string | null;

  setAvailableBalance: (assetCode: AssetCode, amount: number) => void;
  setReserved: (assetCode: AssetCode, amount: number) => void;
  setProjected: (assetCode: AssetCode, amount: number) => void;
  reserveForPayroll: (assetCode: AssetCode, amount: number, obligation: PayrollObligation) => void;
  releaseReservation: (assetCode: AssetCode, amount: number, obligationId: string) => void;
  addObligation: (obligation: PayrollObligation) => void;
  removeObligation: (obligationId: string) => void;
  reset: () => void;
}

const DEFAULT_ASSET = "USDC";

function createDefaultBalance(): TreasuryBalance {
  return { assetCode: DEFAULT_ASSET, available: 45_000, reserved: 0, projected: 19_500 };
}

const initialState = {
  balances: { [DEFAULT_ASSET]: createDefaultBalance() } as Record<AssetCode, TreasuryBalance>,
  obligations: [] as PayrollObligation[],
  lastUpdated: null as string | null,
};

export const useTreasuryStore = create<TreasuryStore>()(
  persist(
    (set) => ({
      ...initialState,

      setAvailableBalance: (assetCode, amount) =>
        set((state) => {
          const existing = state.balances[assetCode] ?? {
            assetCode,
            available: 0,
            reserved: 0,
            projected: 0,
          };
          return {
            balances: {
              ...state.balances,
              [assetCode]: { ...existing, available: amount },
            },
            lastUpdated: new Date().toISOString(),
          };
        }),

      setReserved: (assetCode, amount) =>
        set((state) => {
          const existing = state.balances[assetCode] ?? {
            assetCode,
            available: 0,
            reserved: 0,
            projected: 0,
          };
          return {
            balances: {
              ...state.balances,
              [assetCode]: { ...existing, reserved: amount },
            },
            lastUpdated: new Date().toISOString(),
          };
        }),

      setProjected: (assetCode, amount) =>
        set((state) => {
          const existing = state.balances[assetCode] ?? {
            assetCode,
            available: 0,
            reserved: 0,
            projected: 0,
          };
          return {
            balances: {
              ...state.balances,
              [assetCode]: { ...existing, projected: amount },
            },
            lastUpdated: new Date().toISOString(),
          };
        }),

      reserveForPayroll: (assetCode, amount, obligation) =>
        set((state) => {
          const existing = state.balances[assetCode] ?? {
            assetCode,
            available: 0,
            reserved: 0,
            projected: 0,
          };
          return {
            balances: {
              ...state.balances,
              [assetCode]: {
                ...existing,
                available: Math.max(0, existing.available - amount),
                reserved: existing.reserved + amount,
              },
            },
            obligations: [...state.obligations, obligation],
            lastUpdated: new Date().toISOString(),
          };
        }),

      releaseReservation: (assetCode, amount, obligationId) =>
        set((state) => {
          const balance = state.balances[assetCode];
          if (!balance) {
            throw new Error(`Cannot release ${assetCode}: no treasury balance is available. Refresh the treasury and try again.`);
          }
          if (balance.assetCode !== assetCode) {
            throw new Error(`Cannot release ${assetCode}: the stored treasury balance is tagged as ${balance.assetCode}. Refresh the treasury and try again.`);
          }

          const matchingObligations = state.obligations.filter((item) => item.id === obligationId);
          if (matchingObligations.length !== 1) {
            throw new Error("Cannot release this reservation because its payroll obligation could not be found uniquely. Refresh the treasury and try again.");
          }
          const [obligation] = matchingObligations;

          const validation = validateReserveRelease(balance, amount, obligation);
          if (validation.riskLevel === "blocked") {
            throw new Error(validation.message);
          }

          const remainingObligationAmount = obligation.amount - amount;
          return {
            balances: {
              ...state.balances,
              [assetCode]: {
                ...balance,
                available: balance.available + amount,
                reserved: balance.reserved - amount,
              },
            },
            obligations: remainingObligationAmount === 0
              ? state.obligations.filter((item) => item.id !== obligationId)
              : state.obligations.map((item) =>
                  item.id === obligationId
                    ? { ...item, amount: remainingObligationAmount }
                    : item,
                ),
            lastUpdated: new Date().toISOString(),
          };
        }),

      addObligation: (obligation) =>
        set((state) => ({
          obligations: [...state.obligations, obligation],
          lastUpdated: new Date().toISOString(),
        })),

      removeObligation: (obligationId) =>
        set((state) => ({
          obligations: state.obligations.filter((o) => o.id !== obligationId),
          lastUpdated: new Date().toISOString(),
        })),

      reset: () => set({ ...initialState, balances: { [DEFAULT_ASSET]: createDefaultBalance() } }),
    }),
    { name: "zk-treasury-store" },
  ),
);
