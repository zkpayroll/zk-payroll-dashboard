import { describe, it, expect } from "vitest";
import {
  createAuditTrailStore,
  appendResolutionEntry,
  getResolutionTrail,
  appendOrReject,
  formatTrailSummary,
  filterTrailByAction,
  ExceptionAlreadyClosedError,
} from "@/src/audit/exceptionResolutionAuditTrail";

describe("appendResolutionEntry", () => {
  it("assigns sequence numbers starting at 1", () => {
    const store = createAuditTrailStore();
    const e1 = appendResolutionEntry(store, {
      exceptionId: "exc-1",
      action: "acknowledged",
      operatorId: "op-a",
    });
    const e2 = appendResolutionEntry(store, {
      exceptionId: "exc-1",
      action: "investigation_started",
      operatorId: "op-a",
    });
    expect(e1.sequence).toBe(1);
    expect(e2.sequence).toBe(2);
  });

  it("isolates trails for different exception IDs", () => {
    const store = createAuditTrailStore();
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "acknowledged", operatorId: "op-a" });
    appendResolutionEntry(store, { exceptionId: "exc-2", action: "acknowledged", operatorId: "op-b" });
    expect(getResolutionTrail(store, "exc-1").entryCount).toBe(1);
    expect(getResolutionTrail(store, "exc-2").entryCount).toBe(1);
  });
});

describe("getResolutionTrail", () => {
  it("returns an empty trail for unknown exceptionId", () => {
    const store = createAuditTrailStore();
    const trail = getResolutionTrail(store, "nonexistent");
    expect(trail.hasActivity).toBe(false);
    expect(trail.isClosed).toBe(false);
    expect(trail.latestEntry).toBeNull();
  });

  it("marks trail as closed after a closed entry", () => {
    const store = createAuditTrailStore();
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "acknowledged", operatorId: "op-a" });
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "closed", operatorId: "op-a" });
    expect(getResolutionTrail(store, "exc-1").isClosed).toBe(true);
  });

  it("marks trail as open again after a reopened entry", () => {
    const store = createAuditTrailStore();
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "closed", operatorId: "op-a" });
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "reopened", operatorId: "op-b" });
    expect(getResolutionTrail(store, "exc-1").isClosed).toBe(false);
  });
});

describe("appendOrReject", () => {
  it("allows appending to an open trail", () => {
    const store = createAuditTrailStore();
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "acknowledged", operatorId: "op-a" });
    expect(() =>
      appendOrReject(store, { exceptionId: "exc-1", action: "closed", operatorId: "op-a" }),
    ).not.toThrow();
  });

  it("rejects non-reopen actions on a closed trail", () => {
    const store = createAuditTrailStore();
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "closed", operatorId: "op-a" });
    expect(() =>
      appendOrReject(store, { exceptionId: "exc-1", action: "remediation_applied", operatorId: "op-b" }),
    ).toThrowError(ExceptionAlreadyClosedError);
  });

  it("allows reopened action on a closed trail", () => {
    const store = createAuditTrailStore();
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "closed", operatorId: "op-a" });
    expect(() =>
      appendOrReject(store, { exceptionId: "exc-1", action: "reopened", operatorId: "op-b" }),
    ).not.toThrow();
  });
});

describe("formatTrailSummary", () => {
  it("describes an empty trail", () => {
    const store = createAuditTrailStore();
    const trail = getResolutionTrail(store, "exc-empty");
    expect(formatTrailSummary(trail)).toContain("no resolution activity");
  });

  it("includes entry count and latest action for active trail", () => {
    const store = createAuditTrailStore();
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "acknowledged", operatorId: "op-x" });
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "closed", operatorId: "op-x" });
    const summary = formatTrailSummary(getResolutionTrail(store, "exc-1"));
    expect(summary).toContain("2 entries");
    expect(summary).toContain("closed");
    expect(summary).toContain("op-x");
  });
});

describe("filterTrailByAction", () => {
  it("returns only entries matching the requested actions", () => {
    const store = createAuditTrailStore();
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "acknowledged", operatorId: "op-a" });
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "escalated", operatorId: "op-a" });
    appendResolutionEntry(store, { exceptionId: "exc-1", action: "closed", operatorId: "op-a" });
    const trail = getResolutionTrail(store, "exc-1");
    const filtered = filterTrailByAction(trail, ["acknowledged", "closed"]);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.action)).toEqual(["acknowledged", "closed"]);
  });
});
