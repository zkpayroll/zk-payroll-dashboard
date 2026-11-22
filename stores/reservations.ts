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

/** Maximum allowed custom TTL for reservation renewals (24 hours) to prevent timestamp overflow. */
export const MAX_RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Reservations expiring within this window are flagged with a warning (5 minutes). */
export const RESERVATION_WARNING_WINDOW_MS = 5 * 60 * 1000;

/**
 * Derive the health status of a reservation relative to `now`.
 * Fails closed: malformed timestamps, invalid inputs, or non-finite clocks
 * always resolve to "expired" so contract execution is never permitted silently.
 * Otherwise "expired" at/after `expiresAt`, "warning" inside the warning window,
 * and "healthy" before that.
 */
export function getReservationStatus(
  reservation: Pick<FundingReservation, "expiresAt"> | null | undefined,
  now: number = Date.now(),
  warningWindowMs: number = RESERVATION_WARNING_WINDOW_MS,
): ReservationStatus {
  if (!reservation || typeof reservation.expiresAt !== "string" || !Number.isFinite(now)) {
    return "expired";
  }
  const expiresAtMs = new Date(reservation.expiresAt).getTime();
  const remaining = expiresAtMs - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "expired";
  const safeWindow =
    Number.isFinite(warningWindowMs) && warningWindowMs >= 0
      ? warningWindowMs
      : RESERVATION_WARNING_WINDOW_MS;
  if (remaining <= safeWindow) return "warning";
  return "healthy";
}

/** Milliseconds remaining before the reservation expires (never negative or NaN). */
export function getTimeRemaining(
  reservation: Pick<FundingReservation, "expiresAt"> | null | undefined,
  now: number = Date.now(),
): number {
  if (!reservation || typeof reservation.expiresAt !== "string" || !Number.isFinite(now)) {
    return 0;
  }
  const remaining = new Date(reservation.expiresAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  return remaining;
}

function resolveSafeTtlMs(ttlMs: number): number {
  return Number.isFinite(ttlMs) && ttlMs > 0 && ttlMs <= MAX_RESERVATION_TTL_MS
    ? ttlMs
    : RESERVATION_TTL_MS;
}

function deduplicateReservations(items: FundingReservation[]): FundingReservation[] {
  if (!Array.isArray(items)) return [];
  const indexById = new Map<string, number>();
  const result: FundingReservation[] = [];
  for (const item of items) {
    if (!item || typeof item.id !== "string" || item.id.trim() === "") continue;
    const existingIndex = indexById.get(item.id);
    if (existingIndex !== undefined) {
      result[existingIndex] = item;
    } else {
      indexById.set(item.id, result.length);
      result.push(item);
    }
  }
  return result;
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
  setReservations: (reservations) =>
    set({ reservations: deduplicateReservations(reservations) }),
  addReservation: (reservation) =>
    set((state) => {
      if (!reservation || typeof reservation.id !== "string" || reservation.id.trim() === "") {
        return state;
      }
      const existingIndex = state.reservations.findIndex((r) => r.id === reservation.id);
      if (existingIndex !== -1) {
        const updated = state.reservations.slice();
        updated[existingIndex] = reservation;
        return { reservations: updated };
      }
      return { reservations: [...state.reservations, reservation] };
    }),
  refreshReservation: (id, ttlMs = RESERVATION_TTL_MS) => {
    const safeTtlMs = resolveSafeTtlMs(ttlMs);
    set((state) => ({
      reservations: state.reservations.map((r) =>
        r.id === id && r.canRefresh
          ? { ...r, expiresAt: new Date(Date.now() + safeTtlMs).toISOString() }
          : r,
      ),
    }));
  },
  revalidateReservation: (id, ttlMs = RESERVATION_TTL_MS) => {
    const safeTtlMs = resolveSafeTtlMs(ttlMs);
    set((state) => ({
      reservations: state.reservations.map((r) => {
        if (r.id !== id || !r.canRevalidate) return r;
        const now = new Date();
        return {
          ...r,
          reservedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + safeTtlMs).toISOString(),
        };
      }),
    }));
  },
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
