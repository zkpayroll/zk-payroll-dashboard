import { describe, expect, it } from "vitest";
import type { PayrollTransaction, ReconciliationOutcome } from "@/types/models";
import {
  normalizeReconciliationStatus,
  resolveReconciliationStatus,
} from "@/lib/reconciliation/status";

function makeTransaction(
  overrides: Partial<PayrollTransaction> = {},
): PayrollTransaction {
  return {
    id: "run_test",
    companyId: "company_001",
    timestamp: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    totalAmount: 1000,
    employeeCount: 1,
    proof: "proof",
    status: "verified",
    ...overrides,
  };
}

describe("reconciliation status resolution", () => {
  it("resolves every supported outcome without inspecting payroll values", () => {
    const outcomes: ReconciliationOutcome[] = [
      "matched",
      "pending",
      "mismatched",
      "failed",
      "manually_reviewed",
    ];

    for (const outcome of outcomes) {
      expect(
        resolveReconciliationStatus(
          makeTransaction({ reconciliationStatus: outcome }),
        ),
      ).toBe(outcome);
    }
  });

  it("normalizes legacy complete and partial statuses", () => {
    expect(normalizeReconciliationStatus("complete")).toBe("matched");
    expect(normalizeReconciliationStatus("partial")).toBe("mismatched");
    expect(normalizeReconciliationStatus("unknown" as never)).toBeNull();
    expect(normalizeReconciliationStatus("toString" as never)).toBeNull();
  });

  it("prioritizes an explicit manual review over a discrepancy", () => {
    expect(
      resolveReconciliationStatus(
        makeTransaction({
          reconciliationStatus: "manually_reviewed",
          reconciliationDetails: {
            processedCount: 1,
            totalCount: 2,
            discrepancies: ["difference detected"],
          },
        }),
      ),
    ).toBe("manually_reviewed");
  });

  it("classifies discrepancy details and a failed transaction as actionable", () => {
    expect(
      resolveReconciliationStatus(
        makeTransaction({
          reconciliationDetails: {
            processedCount: 1,
            totalCount: 2,
            discrepancies: ["difference detected"],
          },
        }),
      ),
    ).toBe("mismatched");
    expect(resolveReconciliationStatus(makeTransaction({ status: "failed" }))).toBe(
      "failed",
    );
  });

  it("flags malformed progress instead of treating it as matched", () => {
    expect(
      resolveReconciliationStatus(
        makeTransaction({
          reconciliationDetails: { processedCount: 2, totalCount: 1 },
        }),
      ),
    ).toBe("mismatched");
    expect(
      resolveReconciliationStatus(
        makeTransaction({
          reconciliationDetails: { processedCount: Number.NaN, totalCount: 2 },
        }),
      ),
    ).toBe("mismatched");
  });

  it("handles partial, complete, and zero-record progress conservatively", () => {
    expect(
      resolveReconciliationStatus(
        makeTransaction({
          reconciliationDetails: { processedCount: 1, totalCount: 2 },
        }),
      ),
    ).toBe("mismatched");
    expect(
      resolveReconciliationStatus(
        makeTransaction({
          reconciliationDetails: { processedCount: 2, totalCount: 2 },
        }),
      ),
    ).toBe("matched");
    expect(
      resolveReconciliationStatus(
        makeTransaction({
          reconciliationDetails: { processedCount: 0, totalCount: 2 },
        }),
      ),
    ).toBe("pending");
    expect(
      resolveReconciliationStatus(
        makeTransaction({
          reconciliationDetails: { processedCount: 0, totalCount: 0 },
        }),
      ),
    ).toBe("pending");
  });
});
