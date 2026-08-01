import { describe, it, expect } from "vitest";
import {
  generateIncidentTimeline,
  sortEventsChronologically,
} from "@/src/observability/timeline";
import type { PayrollEvent } from "@/src/observability/types";

describe("Incident Timeline Generator & Ordering", () => {
  it("sorts out-of-order events chronologically by timestamp and sequence", () => {
    const events: PayrollEvent[] = [
      {
        id: "evt_3",
        correlationId: "pay_run_sort",
        sequence: 3,
        timestamp: "2026-07-29T16:00:10.000Z",
        stage: "wallet_signing",
        status: "succeeded",
        payload: { durationMs: 400 },
      },
      {
        id: "evt_1",
        correlationId: "pay_run_sort",
        sequence: 1,
        timestamp: "2026-07-29T16:00:00.000Z",
        stage: "draft",
        status: "succeeded",
        payload: {},
      },
      {
        id: "evt_2",
        correlationId: "pay_run_sort",
        sequence: 2,
        timestamp: "2026-07-29T16:00:05.000Z",
        stage: "validation",
        status: "succeeded",
        payload: { durationMs: 200 },
      },
    ];

    const sorted = sortEventsChronologically(events);

    expect(sorted.map((e) => e.sequence)).toEqual([1, 2, 3]);
    expect(sorted.map((e) => e.stage)).toEqual(["draft", "validation", "wallet_signing"]);
  });

  it("builds a correct IncidentTimeline object with stage summaries and status", () => {
    const events: PayrollEvent[] = [
      {
        id: "evt_1",
        correlationId: "pay_run_demo",
        sequence: 1,
        timestamp: "2026-07-29T16:00:00.000Z",
        stage: "draft",
        status: "succeeded",
        payload: {},
      },
      {
        id: "evt_2",
        correlationId: "pay_run_demo",
        sequence: 2,
        timestamp: "2026-07-29T16:00:02.000Z",
        stage: "validation",
        status: "succeeded",
        payload: { durationMs: 150 },
      },
      {
        id: "evt_3",
        correlationId: "pay_run_demo",
        sequence: 3,
        timestamp: "2026-07-29T16:00:05.000Z",
        stage: "wallet_signing",
        status: "failed",
        payload: { errorCategory: "rejected", errorLabel: "user_declined" },
      },
    ];

    const timeline = generateIncidentTimeline("pay_run_demo", events);

    expect(timeline.correlationId).toBe("pay_run_demo");
    expect(timeline.runStatus).toBe("failed");
    expect(timeline.hasFailures).toBe(true);
    expect(timeline.eventCount).toBe(3);
    expect(timeline.entries.length).toBe(3);

    expect(timeline.entries[2].stage).toBe("wallet_signing");
    expect(timeline.entries[2].status).toBe("failed");
    expect(timeline.entries[2].errorCategory).toBe("rejected");
    expect(timeline.entries[2].formattedSummary).toContain("Signing failed");
  });
});
