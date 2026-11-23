import { create } from "zustand";

export type ReservationStatus = "healthy" | "warning" | "expired";

/** Self-service recovery actions an operator can take on a funding reservation (#889). */
export type ReservationRecoveryAction = "refresh" | "revalidate" | "cancel";

/**
 * Why a recovery action did not change the reservation.
 *
 * - `invalid_id`    – the identifier is missing or blank.
 * - `not_found`     – no reservation with that identifier is tracked.
 * - `not_permitted` – the reservation's permission flag disables the action.
 * - `invalid_data`  – the reservation's amount or asset is corrupt, so renewing
 *                     it in place would revive an unusable lock (fails closed).
 */
export type ReservationActionFailureReason =
  | "invalid_id"
  | "not_found"
  | "not_permitted"
  | "invalid_data";

/** Outcome of a reservation recovery action. Never carries amounts or employee data. */
export type ReservationActionResult =
  | { ok: true; action: ReservationRecoveryAction; reservationId: string }
  | {
      ok: false;
      action: ReservationRecoveryAction;
      reason: ReservationActionFailureReason;
    };

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

const PERMISSION_FLAG: Record<ReservationRecoveryAction, keyof FundingReservation> = {
  refresh: "canRefresh",
  revalidate: "canRevalidate",
  cancel: "canCancel",
};

function checkActionPermitted(
  reservations: FundingReservation[],
  id: string,
  action: ReservationRecoveryAction,
): ReservationActionResult {
  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, action, reason: "invalid_id" };
  }
  const reservation = reservations.find((r) => r.id === id);
  if (!reservation) return { ok: false, action, reason: "not_found" };
  if (reservation[PERMISSION_FLAG[action]] !== true) {
    return { ok: false, action, reason: "not_permitted" };
  }
  return { ok: true, action, reservationId: id };
}

interface ReservationsStore {
  reservations: FundingReservation[];

  setReservations: (reservations: FundingReservation[]) => void;
  addReservation: (reservation: FundingReservation) => void;
  /** Extend expiry by a fresh TTL. Returns whether the reservation changed and why not. */
  refreshReservation: (id: string, ttlMs?: number) => ReservationActionResult;
  /** Re-anchor `reservedAt` to now and extend expiry. */
  revalidateReservation: (id: string, ttlMs?: number) => ReservationActionResult;
  /** Remove the reservation, releasing its hold. */
  cancelReservation: (id: string) => ReservationActionResult;
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
    const check = checkActionPermitted(get().reservations, id, "refresh");
    if (!check.ok) return check;
    const safeTtlMs = resolveSafeTtlMs(ttlMs);
    set((state) => ({
      reservations: state.reservations.map((r) =>
        r.id === id
          ? { ...r, expiresAt: new Date(Date.now() + safeTtlMs).toISOString() }
          : r,
      ),
    }));
    return check;
  },
  revalidateReservation: (id, ttlMs = RESERVATION_TTL_MS) => {
    const check = checkActionPermitted(get().reservations, id, "revalidate");
    if (!check.ok) return check;
    const safeTtlMs = resolveSafeTtlMs(ttlMs);
    set((state) => ({
      reservations: state.reservations.map((r) => {
        if (r.id !== id) return r;
        const now = new Date();
        return {
          ...r,
          reservedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + safeTtlMs).toISOString(),
        };
      }),
    }));
    return check;
  },
  cancelReservation: (id) => {
    const check = checkActionPermitted(get().reservations, id, "cancel");
    if (!check.ok) return check;
    set((state) => ({
      reservations: state.reservations.filter((r) => r.id !== id),
    }));
    return check;
  },
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
