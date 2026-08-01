import { logger } from './logger';
import { categorizeSigningError } from './wallet/signingErrors';

export type TelemetryErrorType =
  | 'circuit_error'
  | 'network_timeout'
  | 'wallet_rejected'
  | 'session_expired'
  | 'malformed_tx'
  | 'wrong_network'
  | 'unknown';

export function mapErrorToType(errorText: string | null): TelemetryErrorType {
  if (!errorText) return 'unknown';

  // Wallet signing failures have their own carefully-tuned categorizer so
  // the overlay and telemetry stay in lock-step. Fall back to the broader
  // heuristics below for non-signing errors (proof, RPC, etc.).
  const signing = categorizeSigningError(errorText);
  switch (signing.category) {
    case 'rejected':
      return 'wallet_rejected';
    case 'expired-session':
      return 'session_expired';
    case 'malformed-transaction':
      return 'malformed_tx';
    case 'wrong-network':
      return 'wrong_network';
    case 'unknown':
      break;
  }

  const lower = errorText.toLowerCase();
  if (lower.includes('circuit') || lower.includes('proof')) return 'circuit_error';
  if (lower.includes('timeout') || lower.includes('network') || lower.includes('disconnect')) return 'network_timeout';
  if (lower.includes('wallet') || lower.includes('reject') || lower.includes('user denied')) return 'wallet_rejected';
  if (lower.includes('expire') || lower.includes('locked') || lower.includes('unauthorized')) return 'session_expired';
  if (lower.includes('malformed') || lower.includes('invalid xdr') || lower.includes('envelope')) return 'malformed_tx';
  return 'unknown';
}

export function bucketEmployeeCount(count: number): string {
  if (count <= 5) return '1-5';
  if (count <= 20) return '6-20';
  if (count <= 50) return '21-50';
  return '50+';
}

export type TelemetryEvents = {
  onboarding_completed: {
    success: boolean;
  };
  payroll_wizard_started: {
    employeeCountBucket: string;
  };
  payroll_proof_generation_completed: {
    success: boolean;
    error_type?: TelemetryErrorType;
  };
  payroll_submission_completed: {
    success: boolean;
    error_type?: TelemetryErrorType;
  };
};

export function trackEvent<K extends keyof TelemetryEvents>(
  eventName: K,
  payload: TelemetryEvents[K]
) {
  // In the future, this is where we would plug in a real analytics provider.
  // For now, we route events to our local logger to verify data shape without external data residency concerns.
  logger.info(`[Telemetry] ${eventName}`, payload as Record<string, unknown>);
}
