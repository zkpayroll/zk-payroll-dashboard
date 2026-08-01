import { categorizeSigningError } from "../../lib/wallet/signingErrors";
import { mapErrorToType } from "../../lib/telemetry";
import { emitPayrollEvent } from "../observability/emitter";
import { getActiveCorrelationId } from "../observability/correlation";
import type { PayrollEvent, PayrollStage } from "../observability/types";

export interface ErrorHookResult {
  event: PayrollEvent;
  category: string;
  label: string;
  message: string;
}

/**
 * Extract structured category, label, and sanitized message from any caught error.
 * Integrates with existing wallet signing failure categorizer (`categorizeSigningError`)
 * and telemetry categorizer (`mapErrorToType`).
 */
export function categorizeError(error: unknown): { category: string; label: string; message: string } {
  let message = "An unknown error occurred";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object" && error !== null) {
    const candidate = error as { message?: unknown };
    if (typeof candidate.message === "string") {
      message = candidate.message;
    }
  }

  const signing = categorizeSigningError(error);
  if (signing.category !== "unknown") {
    return {
      category: signing.category,
      label: signing.label,
      message,
    };
  }

  const telemetryType = mapErrorToType(message);
  return {
    category: telemetryType,
    label: telemetryType,
    message,
  };
}

/**
 * Automatically hook any failure into observability by categorizing the error
 * and emitting a privacy-safe `failed` stage event.
 */
export function emitPayrollFailure(
  stage: PayrollStage,
  error: unknown,
  correlationId?: string,
  extraPayload?: Record<string, unknown>,
): ErrorHookResult {
  const activeId = correlationId || getActiveCorrelationId();
  const { category, label, message } = categorizeError(error);

  const event = emitPayrollEvent({
    correlationId: activeId,
    stage,
    status: "failed",
    payload: {
      errorCategory: category,
      errorLabel: label,
      errorMessage: message,
      ...extraPayload,
    },
  });

  return { event, category, label, message };
}
