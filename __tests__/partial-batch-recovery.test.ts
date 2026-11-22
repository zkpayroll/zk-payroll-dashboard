import { describe, expect, it } from "vitest";
import { beginPartialGroupRetry, completePartialGroupRetry } from "@/lib/payroll/partialBatchRecovery";
import type { MultiAssetPayrollRun } from "@/types/models";

const run: MultiAssetPayrollRun = {
  id: "batch-1",
  companyId: "company-1",
  label: "April payroll",
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "partial",
  totalEmployees: 2,
  proofStatus: "ready",
  assetGroups: [
    {
      asset: { code: "USDC" },
      employees: [],
      totalAmount: 100,
      transactionCount: 1,
      status: "succeeded",
      txHash: "usdc-old",
      treasuryReadiness: { asset: { code: "USDC" }, requiredAmount: 100, availableBalance: 100, isFunded: true, shortfall: 0 },
    },
    {
      asset: { code: "XLM" },
      employees: [],
      totalAmount: 50,
      transactionCount: 1,
      status: "failed",
      errorMessage: "temporary network error",
      treasuryReadiness: { asset: { code: "XLM" }, requiredAmount: 50, availableBalance: 50, isFunded: true, shortfall: 0 },
    },
  ],
};

describe("partial batch recovery", () => {
  it("retries only the failed group and preserves the succeeded group", () => {
    const retrying = beginPartialGroupRetry(run, "XLM");

    expect(retrying.status).toBe("executing");
    expect(retrying.assetGroups[0]).toEqual(run.assetGroups[0]);
    expect(retrying.assetGroups[1].status).toBe("executing");
  });

  it("marks the retry complete and derives a terminal batch state", () => {
    const retrying = beginPartialGroupRetry(run, "XLM");
    const completed = completePartialGroupRetry(retrying, "XLM", "xlm-new", "2026-01-02T00:00:00.000Z");

    expect(completed.status).toBe("succeeded");
    expect(completed.assetGroups[0].txHash).toBe("usdc-old");
    expect(completed.assetGroups[1].txHash).toBe("xlm-new");
    expect(completed.executedAt).toBe("2026-01-02T00:00:00.000Z");
  });
});
