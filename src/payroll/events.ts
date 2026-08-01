import { emitPayrollEvent } from "../observability/emitter";
import { getActiveCorrelationId } from "../observability/correlation";
import type { PayrollEvent, PayrollEventPayload } from "../observability/types";

export interface EmitEventOptions {
  correlationId?: string;
  payload?: PayrollEventPayload;
  timestamp?: string;
}

export function emitDraftCreated(options?: EmitEventOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "draft",
    status: "succeeded",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitValidationStarted(options?: EmitEventOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "validation",
    status: "started",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitValidationSucceeded(options?: EmitEventOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "validation",
    status: "succeeded",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitValidationFailed(
  errorCategory: string,
  errorLabel?: string,
  options?: EmitEventOptions,
): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "validation",
    status: "failed",
    payload: {
      errorCategory,
      errorLabel,
      ...options?.payload,
    },
    timestamp: options?.timestamp,
  });
}

export function emitProofSetupStarted(options?: EmitEventOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "proof_setup",
    status: "started",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitProofSetupSucceeded(options?: EmitEventOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "proof_setup",
    status: "succeeded",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitProofSetupFailed(
  errorCategory: string,
  errorMessage?: string,
  options?: EmitEventOptions,
): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "proof_setup",
    status: "failed",
    payload: {
      errorCategory,
      errorMessage,
      ...options?.payload,
    },
    timestamp: options?.timestamp,
  });
}

export function emitPollingStarted(options?: EmitEventOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "polling",
    status: "started",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitPollingSucceeded(options?: EmitEventOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "polling",
    status: "succeeded",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitPayrollRetry(
  retryCount: number,
  maxRetries?: number,
  options?: EmitEventOptions,
): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "retry",
    status: "retried",
    payload: {
      retryCount,
      maxRetries,
      ...options?.payload,
    },
    timestamp: options?.timestamp,
  });
}

export function emitReconciliationStarted(options?: EmitEventOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "reconciliation",
    status: "started",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitReconciliationSucceeded(options?: EmitEventOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "reconciliation",
    status: "succeeded",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}
