import { create } from "zustand";
import { persist } from "zustand/middleware";

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
                available: existing.available + amount,
                reserved: Math.max(0, existing.reserved - amount),
              },
            },
            obligations: state.obligations.filter((o) => o.id !== obligationId),
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
