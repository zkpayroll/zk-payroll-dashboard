import type {
  IncidentTimeline,
  IncidentTimelineEntry,
  PayrollEvent,
  PayrollStage,
} from "./types";
import { getEventsByCorrelationId } from "./emitter";

const STAGE_LABELS: Record<PayrollStage, string> = {
  draft: "Draft Creation",
  validation: "Payroll Validation",
  proof_setup: "ZK Proof Generation",
  wallet_signing: "Wallet Signing",
  tx_submission: "Transaction Submission",
  polling: "Blockchain Polling",
  failure: "Run Failure",
  retry: "Transaction Retry",
  reconciliation: "Payroll Reconciliation",
};

/**
 * Generate human-readable summary for a timeline entry.
 */

function formatStageSummary(event: PayrollEvent): string {
  const stageName = STAGE_LABELS[event.stage] || event.stage;
  const statusStr = event.status.toUpperCase();

  switch (event.stage) {
    case "draft":
      return `${stageName}: Created initial payroll draft (${event.status})`;
    case "validation":
      return event.status === "failed"
        ? `${stageName}: Validation failed - ${event.payload.errorLabel || event.payload.errorCategory || "Validation Error"}`
        : `${stageName}: Verified funding and employee records (${event.status})`;
    case "proof_setup":
      return event.status === "failed"
        ? `${stageName}: Proof generation failed`
        : `${stageName}: ZK proof generation ${event.status}`;
    case "wallet_signing":
      return event.status === "failed"
        ? `${stageName}: Signing failed [${event.payload.errorCategory || "unknown"}]`
        : `${stageName}: Transaction envelope signed by wallet (${event.status})`;
    case "tx_submission":
      return event.status === "failed"
        ? `${stageName}: Transaction failed to submit`
        : `${stageName}: Broadcasted to network (${event.status})`;
    case "polling":
      return `${stageName}: Network status check (${event.status})`;
    case "failure":
      return `${stageName}: Run halted due to error (${event.payload.errorCategory || "unhandled_error"})`;
    case "retry":
      return `${stageName}: Attempting retry #${event.payload.retryCount || 1}`;
    case "reconciliation":
      return `${stageName}: Settlement audit completed (${event.status})`;
    default:
      return `${stageName} [${statusStr}]`;
  }
}

/**
 * Sort events by timestamp and sequence ascending to guarantee correct chronological ordering,
 * even if events arrived out of order.
 */
export function sortEventsChronologically(events: PayrollEvent[]): PayrollEvent[] {
  return [...events].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.sequence - b.sequence;
  });
}

/**
 * Generate an ordered, human-readable IncidentTimeline for a given correlation ID.
 */
export function generateIncidentTimeline(
  correlationId: string,
  eventsInput?: PayrollEvent[],
): IncidentTimeline {
  const rawEvents = eventsInput ?? getEventsByCorrelationId(correlationId);
  const sorted = sortEventsChronologically(rawEvents);

  if (sorted.length === 0) {
    return {
      correlationId,
      runStatus: "in_progress",
      totalDurationMs: 0,
      eventCount: 0,
      startedAt: new Date().toISOString(),
      endedAt: null,
      hasFailures: false,
      entries: [],
    };
  }

  const startedAt = sorted[0].timestamp;
  const lastEvent = sorted[sorted.length - 1];
  const endedAt =
    lastEvent.status === "succeeded" || lastEvent.status === "failed"
      ? lastEvent.timestamp
      : null;

  const startTimeMs = new Date(startedAt).getTime();
  const endTimeMs = endedAt ? new Date(endedAt).getTime() : Date.now();
  const totalDurationMs = Math.max(0, endTimeMs - startTimeMs);

  let hasFailures = false;
  const entries: IncidentTimelineEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const evt = sorted[i];
    if (evt.status === "failed") {
      hasFailures = true;
    }

    // Compute stage duration if current event is succeeded/failed and previous event was started
    let durationMs: number | undefined =
      typeof evt.payload.durationMs === "number" ? evt.payload.durationMs : undefined;

    if (durationMs === undefined && i > 0 && evt.stage === sorted[i - 1].stage) {
      const prevTime = new Date(sorted[i - 1].timestamp).getTime();
      const currTime = new Date(evt.timestamp).getTime();
      if (!isNaN(prevTime) && !isNaN(currTime)) {
        durationMs = Math.max(0, currTime - prevTime);
      }
    }

    entries.push({
      id: evt.id,
      sequence: evt.sequence,
      timestamp: evt.timestamp,
      stage: evt.stage,
      status: evt.status,
      durationMs,
      errorCategory: evt.payload.errorCategory as string | undefined,
      errorCode: evt.payload.errorCode as string | undefined,
      errorLabel: evt.payload.errorLabel as string | undefined,
      errorMessage: evt.payload.errorMessage as string | undefined,
      redactedContext: evt.payload,
      formattedSummary: formatStageSummary(evt),
    });
  }

  let runStatus: IncidentTimeline["runStatus"] = "in_progress";
  if (lastEvent.stage === "reconciliation" && lastEvent.status === "succeeded") {
    runStatus = "succeeded";
  } else if (hasFailures || lastEvent.status === "failed") {
    runStatus = "failed";
  } else if (lastEvent.status === "succeeded") {
    runStatus = "succeeded";
  }

  return {
    correlationId,
    runStatus,
    totalDurationMs,
    eventCount: sorted.length,
    startedAt,
    endedAt,
    hasFailures,
    entries,
  };
}
