import { describe, it, expect } from "vitest";
import { formatReconciliationDiff } from "@/lib/reconciliation/format";
import type { ReconciliationDiffResult } from "@/lib/reconciliation/types";

function result(overrides: Partial<ReconciliationDiffResult> = {}): ReconciliationDiffResult {
  return {
    entries: [],
    counts: {
      match: 0,
      missing: 0,
      failed_mismatch: 0,
      amount_mismatch: 0,
      still_pending: 0,
      unexpected: 0,
    },
    isFullyReconciled: true,
    generatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("formatReconciliationDiff (vendored SDK helper)", () => {
  it("emits a single header line for an empty run", () => {
    const out = formatReconciliationDiff(result());
    expect(out.startsWith("reconciliation: fully reconciled")).toBe(true);
    expect(out).toContain("no entries");
    expect(out.endsWith("\n")).toBe(true);
  });

  it("reports 'needs attention' when isFullyReconciled is false", () => {
    const out = formatReconciliationDiff(
      result({
        isFullyReconciled: false,
        counts: { match: 0, missing: 1, failed_mismatch: 0, amount_mismatch: 0, still_pending: 0, unexpected: 0 },
      }),
    );
    expect(out.startsWith("reconciliation: needs attention")).toBe(true);
    expect(out).toContain("1 missing");
  });

  it("sorts actionable categories before routine ones", () => {
    const r = result({
      isFullyReconciled: false,
      entries: [
        {
          recipient: "GALICE",
          category: "match",
          reason: "ok",
        },
        {
          recipient: "GBOB",
          category: "failed_mismatch",
          reason: "client says success, chain says failed",
        },
        {
          recipient: "GCHARLIE",
          category: "missing",
          reason: "no on-chain record",
        },
      ],
      counts: { match: 1, missing: 1, failed_mismatch: 1, amount_mismatch: 0, still_pending: 0, unexpected: 0 },
    });
    const out = formatReconciliationDiff(r);
    const lines = out.split("\n");
    const bobIdx = lines.findIndex((l) => l.includes("GBOB"));
    const charlieIdx = lines.findIndex((l) => l.includes("GCHARLIE"));
    const aliceIdx = lines.findIndex((l) => l.includes("GALICE"));
    expect(bobIdx).toBeLessThan(charlieIdx);
    expect(charlieIdx).toBeLessThan(aliceIdx);
  });

  it("honours custom indent and newline options", () => {
    const r = result({
      entries: [{ recipient: "GALICE", category: "match", reason: "ok" }],
    });
    const out = formatReconciliationDiff(r, {
      indent: ">>",
      newline: "|",
    });
    expect(out).toContain(">>GALICE");
    expect(out).toContain("|");
  });

  it("is pure: same input => same output", () => {
    const r = result({
      entries: [{ recipient: "GALICE", category: "match", reason: "ok" }],
    });
    expect(formatReconciliationDiff(r)).toBe(formatReconciliationDiff(r));
  });

  it("buckets match + still_pending under 'routine' in the count summary", () => {
    const out = formatReconciliationDiff(
      result({
        counts: {
          match: 3,
          missing: 0,
          failed_mismatch: 0,
          amount_mismatch: 0,
          still_pending: 2,
          unexpected: 0,
        },
        entries: [],
      }),
    );
    expect(out).toContain("5 routine");
  });
});