import { createLogger } from './logger';
import { sanitize } from './sanitize';

const log = createLogger('monitoring');

let initialized = false;

export function initMonitoring(): void {
  if (initialized) return;
  initialized = true;

  if (typeof window === 'undefined') return;

  window.onerror = (message, source, lineno, colno, error) => {
    log.error('Unhandled error', {
      message: String(message),
      source: source ?? undefined,
      lineno: lineno ?? undefined,
      colno: colno ?? undefined,
      stack: error?.stack,
    });
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error
      ? { message: event.reason.message, stack: event.reason.stack }
      : { message: String(event.reason) };
    log.error('Unhandled promise rejection', reason);
  };

  log.info('Monitoring initialized');
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorInfo = error instanceof Error
    ? { message: error.message, stack: error.stack, name: error.name }
    : { message: String(error) };

  const sanitizedContext = context ? sanitize(context) : {};

  log.error('Captured exception', { ...errorInfo, ...sanitizedContext });

  // Future: Sentry.captureException(error, { extra: sanitizedContext });
}

export function startPerformanceMark(name: string): void {
  try {
    performance.mark(`${name}-start`);
  } catch {
    // performance API not available
  }
}

export function endPerformanceMark(name: string): void {
  try {
    performance.mark(`${name}-end`);
    const measure = performance.measure(name, `${name}-start`, `${name}-end`);
    log.info(`Performance: ${name}`, { durationMs: measure.duration });
  } catch {
    // marks may not exist or performance API not available
  }
}
