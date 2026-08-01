import type { PayrollEvent, PayrollEventInput } from "./types";
import { redactEvent } from "./redaction";
import { getActiveCorrelationId } from "./correlation";

let globalSequence = 0;
const eventStore: PayrollEvent[] = [];
type EventListener = (event: PayrollEvent) => void;
const listeners = new Set<EventListener>();

/**
 * Emit a structured, privacy-safe payroll observability event.
 * All events pass through the central `redactEvent` choke point before storage/broadcast.
 */
export function emitPayrollEvent(input: PayrollEventInput): PayrollEvent {
  globalSequence += 1;
  const correlationId = input.correlationId || getActiveCorrelationId();
  const timestamp = input.timestamp || new Date().toISOString();
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const rawEvent: PayrollEvent = {
    id: eventId,
    correlationId,
    sequence: globalSequence,
    timestamp,
    stage: input.stage,
    status: input.status,
    payload: input.payload ?? {},
  };

  // Pass through central redaction choke point
  const redacted = redactEvent(rawEvent);

  eventStore.push(redacted);

  Array.from(listeners).forEach((listener) => {
    try {
      listener(redacted);
    } catch {
      // Ignore listener error to avoid breaking main execution flow
    }
  });

  return redacted;
}

/**
 * Retrieve all redacted events matching a specific correlation ID.
 */
export function getEventsByCorrelationId(correlationId: string): PayrollEvent[] {
  return eventStore.filter((evt) => evt.correlationId === correlationId);
}

/**
 * Retrieve all events currently stored.
 */
export function getAllEvents(): PayrollEvent[] {
  return [...eventStore];
}

/**
 * Subscribe to new observability events as they are emitted.
 * Returns an unsubscribe function.
 */
export function subscribePayrollEvents(listener: EventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Clear all stored events and reset sequence counter (used primarily in tests).
 */
export function clearEventStore(): void {
  eventStore.length = 0;
  globalSequence = 0;
}
