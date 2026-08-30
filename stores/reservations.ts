import { create } from "zustand";

export type ReservationStatus = "healthy" | "warning" | "expired";

export interface FundingReservation {
  id: string;
  batchId: string;
  asset: string;
  amount: string;
  reservedAt: string;
  expiresAt: string;
  canRefresh: boolean;
  canCancel: boolean;
  canRevalidate: boolean;
}

/** Time-to-live applied when a reservation is refreshed or revalidated (15 minutes). */
export const RESERVATION_TTL_MS = 15 * 60 * 1000;

/** Reservations expiring within this window are flagged with a warning (5 minutes). */
export const RESERVATION_WARNING_WINDOW_MS = 5 * 60 * 1000;

/**
 * Derive the health status of a reservation relative to `now`.
 * A reservation is "expired" once it reaches or passes `expiresAt`, "warning"
 * while it sits inside the warning window, and "healthy" otherwise.
 */
export function getReservationStatus(
  reservation: Pick<FundingReservation, "expiresAt">,
  now: number = Date.now(),
  warningWindowMs: number = RESERVATION_WARNING_WINDOW_MS,
): ReservationStatus {
  const remaining = new Date(reservation.expiresAt).getTime() - now;
  if (remaining <= 0) return "expired";
  if (remaining <= warningWindowMs) return "warning";
  return "healthy";
}

/** Milliseconds remaining before the reservation expires (never negative). */
export function getTimeRemaining(
  reservation: Pick<FundingReservation, "expiresAt">,
  now: number = Date.now(),
): number {
  return Math.max(0, new Date(reservation.expiresAt).getTime() - now);
}

interface ReservationsStore {
  reservations: FundingReservation[];

  setReservations: (reservations: FundingReservation[]) => void;
  addReservation: (reservation: FundingReservation) => void;
  refreshReservation: (id: string, ttlMs?: number) => void;
  revalidateReservation: (id: string, ttlMs?: number) => void;
  cancelReservation: (id: string) => void;
  getReservation: (id: string) => FundingReservation | undefined;
  getExpiringReservations: (
    now?: number,
    warningWindowMs?: number,
  ) => FundingReservation[];
  hasExpiredReservations: (now?: number) => boolean;
  canExecute: (now?: number) => boolean;
  reset: () => void;
}

const initialState = {
  reservations: [] as FundingReservation[],
};

export const useReservationsStore = create<ReservationsStore>()((set, get) => ({
  ...initialState,
  setReservations: (reservations) => set({ reservations }),
  addReservation: (reservation) =>
    set((state) => ({ reservations: [...state.reservations, reservation] })),
  refreshReservation: (id, ttlMs = RESERVATION_TTL_MS) =>
    set((state) => ({
      reservations: state.reservations.map((r) =>
        r.id === id && r.canRefresh
          ? { ...r, expiresAt: new Date(Date.now() + ttlMs).toISOString() }
          : r,
      ),
    })),
  revalidateReservation: (id, ttlMs = RESERVATION_TTL_MS) =>
    set((state) => ({
      reservations: state.reservations.map((r) => {
        if (r.id !== id || !r.canRevalidate) return r;
        const now = new Date();
        return {
          ...r,
          reservedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
        };
      }),
    })),
  cancelReservation: (id) =>
    set((state) => ({
      reservations: state.reservations.filter(
        (r) => !(r.id === id && r.canCancel),
      ),
    })),
  getReservation: (id) => get().reservations.find((r) => r.id === id),
  getExpiringReservations: (now = Date.now(), warningWindowMs) =>
    get().reservations.filter((r) => {
      const status = getReservationStatus(r, now, warningWindowMs);
      return status === "warning" || status === "expired";
    }),
  hasExpiredReservations: (now = Date.now()) =>
    get().reservations.some(
      (r) => getReservationStatus(r, now) === "expired",
    ),
  canExecute: (now = Date.now()) => !get().hasExpiredReservations(now),
  reset: () => set({ ...initialState, reservations: [] }),
}));
