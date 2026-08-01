/**
 * Utilities for generating and managing payroll correlation IDs.
 * Correlation IDs link validation, proof setup, wallet signing, transaction
 * submission, polling, retry, and reconciliation events across an entire payroll run.
 */

let activeCorrelationId: string | null = null;

/**
 * Generate a unique correlation ID for a payroll run.
 * Format: pay_run_<timestamp_ms>_<random_hex>
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now();
  const randomHex = Math.random().toString(36).substring(2, 10);
  return `pay_run_${timestamp}_${randomHex}`;
}

/**
 * Set the currently active correlation ID for the process/session.
 */
export function setActiveCorrelationId(correlationId: string | null): void {
  activeCorrelationId = correlationId;
}

/**
 * Retrieve the active correlation ID or generate a new fallback if none exists.
 */
export function getActiveCorrelationId(): string {
  if (!activeCorrelationId) {
    activeCorrelationId = generateCorrelationId();
  }
  return activeCorrelationId;
}

/**
 * Clear the current active correlation ID context.
 */
export function clearActiveCorrelationId(): void {
  activeCorrelationId = null;
}

/**
 * Scope an async or synchronous function execution to a specific correlation ID.
 */
export async function withCorrelationId<T>(
  correlationId: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previousId = activeCorrelationId;
  activeCorrelationId = correlationId;
  try {
    return await fn();
  } finally {
    activeCorrelationId = previousId;
  }
}
