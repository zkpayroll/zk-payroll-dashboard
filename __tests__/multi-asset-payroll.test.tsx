import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  groupEmployeesByAsset,
  deriveRunStatus,
  buildReconciliation,
  formatAssetAmount,
  assetLabel,
  isNative,
} from "@/lib/payroll/multiAsset";
import type {
  AssetGroup,
  MultiAssetPayrollRun,
} from "@/types/models";
import { MOCK_MULTI_ASSET_RUNS } from "@/lib/api/mockData";

// ── lib/payroll/multiAsset unit tests ────────────────────────────────────────

describe("assetLabel", () => {
  it("labels native XLM correctly", () => {
    expect(assetLabel({ code: "XLM" })).toBe("XLM (native)");
  });

  it("labels issued assets with their code", () => {
    expect(assetLabel({ code: "USDC", issuer: "GABC" })).toBe("USDC");
  });
});

describe("isNative", () => {
  it("returns true for XLM without issuer", () => {
    expect(isNative({ code: "XLM" })).toBe(true);
  });

  it("returns false for issued XLM-like token", () => {
    expect(isNative({ code: "XLM", issuer: "GABC" })).toBe(false);
  });
});

describe("formatAssetAmount", () => {
  it("formats whole numbers with 2 decimal places", () => {
    expect(formatAssetAmount(1000, "USDC")).toContain("1,000");
    expect(formatAssetAmount(1000, "USDC")).toContain("USDC");
  });

  it("formats fractional amounts", () => {
    const result = formatAssetAmount(123.456789, "XLM");
    expect(result).toContain("XLM");
  });
});

describe("groupEmployeesByAsset", () => {
  const employees = [
    { employeeId: "e1", name: "Alice", address: "GA1", amount: 1000, salaryCommitment: "0x1", assetCode: "USDC", assetIssuer: "GISSUER" },
    { employeeId: "e2", name: "Bob", address: "GB2", amount: 2000, salaryCommitment: "0x2", assetCode: "USDC", assetIssuer: "GISSUER" },
    { employeeId: "e3", name: "Carol", address: "GC3", amount: 500, salaryCommitment: "0x3", assetCode: "XLM" },
  ];

  const balances = new Map<string, number>([
    ["USDC:GISSUER", 5000],
    ["XLM", 200],
  ]);

  it("groups employees into correct asset buckets", () => {
    const groups = groupEmployeesByAsset(employees, balances);
    expect(groups).toHaveLength(2);
    const usdc = groups.find((g) => g.asset.code === "USDC")!;
    const xlm = groups.find((g) => g.asset.code === "XLM")!;
    expect(usdc.employees).toHaveLength(2);
    expect(xlm.employees).toHaveLength(1);
  });

  it("computes correct totals per group", () => {
    const groups = groupEmployeesByAsset(employees, balances);
    const usdc = groups.find((g) => g.asset.code === "USDC")!;
    expect(usdc.totalAmount).toBe(3000);
  });

  it("marks group as funded when balance is sufficient", () => {
    const groups = groupEmployeesByAsset(employees, balances);
    const usdc = groups.find((g) => g.asset.code === "USDC")!;
    expect(usdc.status).toBe("funded");
    expect(usdc.treasuryReadiness.isFunded).toBe(true);
    expect(usdc.treasuryReadiness.shortfall).toBe(0);
  });

  it("marks group as underfunded when balance is insufficient", () => {
    // XLM balance=200, required=500
    const groups = groupEmployeesByAsset(employees, balances);
    const xlm = groups.find((g) => g.asset.code === "XLM")!;
    expect(xlm.status).toBe("underfunded");
    expect(xlm.treasuryReadiness.isFunded).toBe(false);
    expect(xlm.treasuryReadiness.shortfall).toBe(300);
  });

  it("handles missing balance key as underfunded with full shortfall", () => {
    const groups = groupEmployeesByAsset(employees, new Map());
    const usdc = groups.find((g) => g.asset.code === "USDC")!;
    expect(usdc.status).toBe("underfunded");
    expect(usdc.treasuryReadiness.shortfall).toBe(3000);
  });
});

describe("deriveRunStatus", () => {
  const makeGroup = (status: AssetGroup["status"]): AssetGroup => ({
    asset: { code: "USDC" },
    employees: [],
    totalAmount: 0,
    transactionCount: 0,
    status,
    treasuryReadiness: { asset: { code: "USDC" }, requiredAmount: 0, availableBalance: 0, isFunded: true, shortfall: 0 },
  });

  it("returns draft for empty groups", () => {
    expect(deriveRunStatus([])).toBe("draft");
  });

  it("returns underfunded when any group is underfunded", () => {
    expect(deriveRunStatus([makeGroup("funded"), makeGroup("underfunded")])).toBe("underfunded");
  });

  it("returns ready when all groups are funded", () => {
    expect(deriveRunStatus([makeGroup("funded"), makeGroup("funded")])).toBe("ready");
  });

  it("returns succeeded when all groups succeeded", () => {
    expect(deriveRunStatus([makeGroup("succeeded"), makeGroup("succeeded")])).toBe("succeeded");
  });

  it("returns partial when some succeed and some fail", () => {
    expect(deriveRunStatus([makeGroup("succeeded"), makeGroup("failed")])).toBe("partial");
  });

  it("returns failed when all groups failed", () => {
    expect(deriveRunStatus([makeGroup("failed"), makeGroup("failed")])).toBe("failed");
  });
});

describe("buildReconciliation", () => {
  it("returns a reconciliation with one group per asset group in the run", () => {
    const run = MOCK_MULTI_ASSET_RUNS[0]; // succeeded run
    const recon = buildReconciliation(run);
    expect(recon.runId).toBe(run.id);
    expect(recon.groups).toHaveLength(run.assetGroups.length);
  });

  it("marks entries as confirmed for succeeded groups", () => {
    const run = MOCK_MULTI_ASSET_RUNS[0];
    const recon = buildReconciliation(run);
    for (const group of recon.groups) {
      for (const entry of group.entries) {
        expect(entry.status).toBe("confirmed");
        expect(entry.confirmedAmount).toBe(entry.expectedAmount);
      }
    }
  });

  it("marks entries as missing for failed groups", () => {
    const run = MOCK_MULTI_ASSET_RUNS[1]; // partial run — USDC group failed
    const recon = buildReconciliation(run);
    const usdcGroup = recon.groups.find((g) => g.asset.code === "USDC")!;
    expect(usdcGroup.status).toBe("failed");
    for (const entry of usdcGroup.entries) {
      expect(entry.status).toBe("missing");
      expect(entry.confirmedAmount).toBe(0);
    }
  });

  it("canExportAudit is true when all groups are complete or partial", () => {
    const run = MOCK_MULTI_ASSET_RUNS[0];
    const recon = buildReconciliation(run);
    expect(recon.canExportAudit).toBe(true);
  });

  it("canExportAudit is false when any group is still pending", () => {
    const run = MOCK_MULTI_ASSET_RUNS[2]; // underfunded/draft
    // Override status to make it at least partially executable
    const modified: MultiAssetPayrollRun = {
      ...run,
      status: "partial",
      assetGroups: run.assetGroups.map((g, i) => ({
        ...g,
        status: i === 0 ? "succeeded" : "pending",
      })),
    };
    const recon = buildReconciliation(modified);
    expect(recon.canExportAudit).toBe(false);
  });
});

// ── Single-asset payroll run (no grouping complexity) ─────────────────────────

describe("single-asset happy path", () => {
  it("a run with one asset group and fully funded treasury returns ready status", () => {
    const employees = [
      { employeeId: "e1", name: "Alice", address: "GA1", amount: 1000, salaryCommitment: "0x1", assetCode: "XLM" },
    ];
    const balances = new Map([["XLM", 5000]]);
    const [group] = groupEmployeesByAsset(employees, balances);
    expect(deriveRunStatus([group])).toBe("ready");
  });
});

// ── Partially funded multi-asset run ─────────────────────────────────────────

describe("partially funded run blocks submission", () => {
  it("returns underfunded when any group has insufficient balance", () => {
    const employees = [
      { employeeId: "e1", name: "Alice", address: "GA1", amount: 10000, salaryCommitment: "0x1", assetCode: "USDC", assetIssuer: "GABC" },
      { employeeId: "e2", name: "Bob", address: "GB2", amount: 500, salaryCommitment: "0x2", assetCode: "XLM" },
    ];
    const balances = new Map<string, number>([
      ["USDC:GABC", 1000], // underfunded by 9000
      ["XLM", 5000],
    ]);
    const groups = groupEmployeesByAsset(employees, balances);
    expect(deriveRunStatus(groups)).toBe("underfunded");
  });
});
