export interface FundingReservationCreatedEvent {
  reservationId: string;
  /** Reference to the payroll run the reservation was made for, if any. */
  payrollRunId?: string;
  createdAt: string;
}

type ReservationListener = (event: FundingReservationCreatedEvent) => void;

const listeners = new Set<ReservationListener>();

export function onFundingReservationCreated(listener: ReservationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitFundingReservationCreated(event: FundingReservationCreatedEvent): void {
  Array.from(listeners).forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Ignore listener errors so one bad subscriber can't break the others.
    }
  });
}

/**
 * Create a funding reservation for treasury funds and notify subscribers.
 * The payload intentionally carries only a safe reservation identifier and
 * optional payroll run reference — no salary totals or employee details.
 */
export function createFundingReservation(
  payrollRunId?: string,
): FundingReservationCreatedEvent {
  const event: FundingReservationCreatedEvent = {
    reservationId: `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    payrollRunId,
    createdAt: new Date().toISOString(),
  };

  emitFundingReservationCreated(event);
  return event;
}
