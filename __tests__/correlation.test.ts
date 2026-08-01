import { describe, it, expect, beforeEach } from "vitest";
import {
  generateCorrelationId,
  setActiveCorrelationId,
  getActiveCorrelationId,
  clearActiveCorrelationId,
  withCorrelationId,
} from "@/src/observability/correlation";
import {
  emitPayrollEvent,
  getEventsByCorrelationId,
  clearEventStore,
} from "@/src/observability/emitter";

describe("Correlation ID Propagation & Isolation", () => {
  beforeEach(() => {
    clearActiveCorrelationId();
    clearEventStore();
  });

  it("generates unique correlation IDs matching pay_run pattern", () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();

    expect(id1).toMatch(/^pay_run_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^pay_run_\d+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it("threads the same correlation ID across multiple stages", () => {
    const runId = generateCorrelationId();
    setActiveCorrelationId(runId);

    emitPayrollEvent({ stage: "draft", status: "succeeded", correlationId: getActiveCorrelationId() });
    emitPayrollEvent({ stage: "validation", status: "succeeded", correlationId: getActiveCorrelationId() });
    emitPayrollEvent({ stage: "proof_setup", status: "succeeded", correlationId: getActiveCorrelationId() });
    emitPayrollEvent({ stage: "wallet_signing", status: "succeeded", correlationId: getActiveCorrelationId() });
    emitPayrollEvent({ stage: "reconciliation", status: "succeeded", correlationId: getActiveCorrelationId() });

    const runEvents = getEventsByCorrelationId(runId);

    expect(runEvents.length).toBe(5);
    expect(runEvents.every((e) => e.correlationId === runId)).toBe(true);
    expect(runEvents.map((e) => e.stage)).toEqual([
      "draft",
      "validation",
      "proof_setup",
      "wallet_signing",
      "reconciliation",
    ]);
  });

  it("isolates concurrent payroll runs without cross-contaminating correlation IDs", async () => {
    const runIdA = "pay_run_A";
    const runIdB = "pay_run_B";

    await Promise.all([
      withCorrelationId(runIdA, async () => {
        emitPayrollEvent({ stage: "draft", status: "succeeded", correlationId: runIdA });
        await new Promise((resolve) => setTimeout(resolve, 10));
        emitPayrollEvent({ stage: "wallet_signing", status: "succeeded", correlationId: runIdA });
      }),
      withCorrelationId(runIdB, async () => {
        emitPayrollEvent({ stage: "draft", status: "succeeded", correlationId: runIdB });
        await new Promise((resolve) => setTimeout(resolve, 10));
        emitPayrollEvent({ stage: "validation", status: "failed", correlationId: runIdB });
      }),
    ]);

    const eventsA = getEventsByCorrelationId(runIdA);
    const eventsB = getEventsByCorrelationId(runIdB);

    expect(eventsA.length).toBe(2);
    expect(eventsA.every((e) => e.correlationId === runIdA)).toBe(true);

    expect(eventsB.length).toBe(2);
    expect(eventsB.every((e) => e.correlationId === runIdB)).toBe(true);
  });
});
