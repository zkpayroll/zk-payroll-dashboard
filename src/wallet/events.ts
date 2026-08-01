import { emitPayrollEvent } from "../observability/emitter";
import { getActiveCorrelationId } from "../observability/correlation";
import type { PayrollEvent, PayrollEventPayload } from "../observability/types";

export interface WalletEmitOptions {
  correlationId?: string;
  payload?: PayrollEventPayload;
  timestamp?: string;
}

export function emitWalletSigningStarted(options?: WalletEmitOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "wallet_signing",
    status: "started",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitWalletSigningSucceeded(
  txHash?: string,
  options?: WalletEmitOptions,
): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "wallet_signing",
    status: "succeeded",
    payload: {
      transactionHash: txHash,
      txHash,
      ...options?.payload,
    },
    timestamp: options?.timestamp,
  });
}

export function emitWalletSigningFailed(
  errorCategory: string,
  errorLabel?: string,
  options?: WalletEmitOptions,
): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "wallet_signing",
    status: "failed",
    payload: {
      errorCategory,
      errorLabel,
      ...options?.payload,
    },
    timestamp: options?.timestamp,
  });
}

export function emitTxSubmissionStarted(options?: WalletEmitOptions): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "tx_submission",
    status: "started",
    payload: options?.payload,
    timestamp: options?.timestamp,
  });
}

export function emitTxSubmissionSucceeded(
  txHash?: string,
  options?: WalletEmitOptions,
): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "tx_submission",
    status: "succeeded",
    payload: {
      transactionHash: txHash,
      txHash,
      ...options?.payload,
    },
    timestamp: options?.timestamp,
  });
}

export function emitTxSubmissionFailed(
  errorCategory: string,
  errorMessage?: string,
  options?: WalletEmitOptions,
): PayrollEvent {
  const correlationId = options?.correlationId || getActiveCorrelationId();
  return emitPayrollEvent({
    correlationId,
    stage: "tx_submission",
    status: "failed",
    payload: {
      errorCategory,
      errorMessage,
      ...options?.payload,
    },
    timestamp: options?.timestamp,
  });
}
