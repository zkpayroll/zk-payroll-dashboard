export type ReservationStateType =
  | "created"
  | "updated"
  | "expired"
  | "cancelled"
  | "released";

export interface FundingReservationCreatedEvent {
  reservationId: string;
  /** Reference to the payroll run the reservation was made for, if any. */
  payrollRunId?: string;
  createdAt: string;
}

export interface FundingReservationEvent {
  id: string;
  reservationId: string;
  state: ReservationStateType;
  createdAt: string;
  payrollRunId?: string;
  summary: string;
  amount?: number;
  actor?: string;
}

type CreatedListener = (event: FundingReservationCreatedEvent) => void;
type ReservationEventListener = (event: FundingReservationEvent) => void;

const createdListeners = new Set<CreatedListener>();
const allEventListeners = new Set<ReservationEventListener>();

const DEFAULT_TIMELINE_EVENTS: FundingReservationEvent[] = [
  {
    id: "evt_init_1",
    reservationId: "res_cycle_aug_01",
    state: "created",
    createdAt: "2026-08-25T09:00:00Z",
    payrollRunId: "run_2026_08_a",
    summary: "Treasury funds locked for August standard payroll cycle",
    amount: 145000,
    actor: "Admin (Auto-scheduler)",
  },
  {
    id: "evt_init_2",
    reservationId: "res_cycle_aug_01",
    state: "updated",
    createdAt: "2026-08-25T14:30:00Z",
    payrollRunId: "run_2026_08_a",
    summary: "Reservation adjusted after employee count update",
    amount: 152000,
    actor: "Operator (0x4f...91)",
  },
  {
    id: "evt_init_3",
    reservationId: "res_temp_adhoc_99",
    state: "expired",
    createdAt: "2026-08-26T00:00:00Z",
    summary: "Ad-hoc bonus reservation expired after 24h timeout",
    amount: 12000,
    actor: "System",
  },
  {
    id: "evt_init_4",
    reservationId: "res_cycle_jul_final",
    state: "released",
    createdAt: "2026-08-26T11:15:00Z",
    payrollRunId: "run_2026_07_final",
    summary: "Funds successfully disbursed and unallocated balance released",
    amount: 148500,
    actor: "Soroban Verifier",
  },
];

let eventLog: FundingReservationEvent[] = [...DEFAULT_TIMELINE_EVENTS];

export function onFundingReservationCreated(listener: CreatedListener): () => void {
  createdListeners.add(listener);
  return () => createdListeners.delete(listener);
}

export function onFundingReservationEvent(listener: ReservationEventListener): () => void {
  allEventListeners.add(listener);
  return () => allEventListeners.delete(listener);
}

function emitFundingReservationCreated(event: FundingReservationCreatedEvent): void {
  Array.from(createdListeners).forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Ignore listener errors so one bad subscriber can't break the others.
    }
  });
}

function emitFundingReservationEvent(event: FundingReservationEvent): void {
  eventLog.unshift(event);
  Array.from(allEventListeners).forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Ignore listener errors so one bad subscriber can't break the others.
    }
  });
}

export function getFundingReservationTimeline(
  reservationId?: string,
): FundingReservationEvent[] {
  const events = reservationId
    ? eventLog.filter((e) => e.reservationId === reservationId)
    : [...eventLog];

  // Return in chronological order (newest first or oldest first)
  return events.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function resetFundingReservationEvents(): void {
  eventLog = [...DEFAULT_TIMELINE_EVENTS];
}

export function clearAllFundingReservationEvents(): void {
  eventLog = [];
}

/**
 * Create a funding reservation for treasury funds and notify subscribers.
 * The payload intentionally carries only a safe reservation identifier and
 * optional payroll run reference — no salary totals or employee details.
 */
export function createFundingReservation(
  payrollRunId?: string,
  amount?: number,
): FundingReservationCreatedEvent {
  const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();

  const createdEvent: FundingReservationCreatedEvent = {
    reservationId,
    payrollRunId,
    createdAt,
  };

  const timelineEvent: FundingReservationEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    reservationId,
    state: "created",
    createdAt,
    payrollRunId,
    summary: payrollRunId
      ? `Funding reserved for payroll run ${payrollRunId}`
      : "Treasury funding reservation created",
    amount,
    actor: "Operator",
  };

  emitFundingReservationCreated(createdEvent);
  emitFundingReservationEvent(timelineEvent);

  return createdEvent;
}

export function updateFundingReservation(
  reservationId: string,
  details: { amount?: number; payrollRunId?: string; summary?: string },
): FundingReservationEvent {
  const createdAt = new Date().toISOString();
  const event: FundingReservationEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    reservationId,
    state: "updated",
    createdAt,
    payrollRunId: details.payrollRunId,
    summary: details.summary || `Funding reservation ${reservationId} updated`,
    amount: details.amount,
    actor: "Operator",
  };

  emitFundingReservationEvent(event);
  return event;
}

export function expireFundingReservation(
  reservationId: string,
  summary?: string,
): FundingReservationEvent {
  const createdAt = new Date().toISOString();
  const event: FundingReservationEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    reservationId,
    state: "expired",
    createdAt,
    summary: summary || `Funding reservation ${reservationId} reached expiration deadline`,
    actor: "System",
  };

  emitFundingReservationEvent(event);
  return event;
}

export function cancelFundingReservation(
  reservationId: string,
  reason?: string,
): FundingReservationEvent {
  const createdAt = new Date().toISOString();
  const event: FundingReservationEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    reservationId,
    state: "cancelled",
    createdAt,
    summary: reason ? `Reservation cancelled: ${reason}` : `Funding reservation ${reservationId} cancelled`,
    actor: "Operator",
  };

  emitFundingReservationEvent(event);
  return event;
}

export function releaseFundingReservation(
  reservationId: string,
  summary?: string,
): FundingReservationEvent {
  const createdAt = new Date().toISOString();
  const event: FundingReservationEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    reservationId,
    state: "released",
    createdAt,
    summary: summary || `Reserved funds released back to available treasury balance`,
    actor: "Contract Executor",
  };

  emitFundingReservationEvent(event);
  return event;
}
