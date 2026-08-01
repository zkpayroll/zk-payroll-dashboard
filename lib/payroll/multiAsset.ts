import type {
  AssetGroup,
  AssetGroupEmployee,
  MultiAssetPayrollRun,
  MultiAssetReconciliation,
  ReconciliationEntry,
  StellarAsset,
  TreasuryReadiness,
} from "@/types/models";

/** Canonical display label for a Stellar asset. */
export function assetLabel(asset: StellarAsset): string {
  return asset.code === "XLM" && !asset.issuer ? "XLM (native)" : asset.code;
}

/** True when the asset is native Stellar lumens. */
export function isNative(asset: StellarAsset): boolean {
  return asset.code === "XLM" && !asset.issuer;
}

/**
 * Group employees by their payment asset and compute per-group totals.
 * Each employee is expected to have `assetCode`/`assetIssuer` on the
 * extended employee record produced by the multi-asset planner.
 */
export function groupEmployeesByAsset(
  employees: Array<AssetGroupEmployee & { assetCode: string; assetIssuer?: string }>,
  treasuryBalances: Map<string, number>,
): AssetGroup[] {
  const byKey = new Map<string, Array<AssetGroupEmployee & { assetCode: string; assetIssuer?: string }>>();

  for (const emp of employees) {
    const key = emp.assetIssuer ? `${emp.assetCode}:${emp.assetIssuer}` : emp.assetCode;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(emp);
  }

  return Array.from(byKey.entries()).map(([_key, emps]) => {
    const first = emps[0];
    const asset: StellarAsset = { code: first.assetCode, issuer: first.assetIssuer };
    const assetKey = asset.issuer ? `${asset.code}:${asset.issuer}` : asset.code;
    const totalAmount = emps.reduce((s, e) => s + e.amount, 0);
    const availableBalance = treasuryBalances.get(assetKey) ?? 0;
    const isFunded = availableBalance >= totalAmount;

    const treasuryReadiness: TreasuryReadiness = {
      asset,
      requiredAmount: totalAmount,
      availableBalance,
      isFunded,
      shortfall: isFunded ? 0 : totalAmount - availableBalance,
    };

    return {
      asset,
      employees: emps.map((e) => ({
        employeeId: e.employeeId,
        name: e.name,
        address: e.address,
        amount: e.amount,
        salaryCommitment: e.salaryCommitment,
      })),
      totalAmount,
      transactionCount: emps.length,
      status: isFunded ? "funded" : "underfunded",
      treasuryReadiness,
    } satisfies AssetGroup;
  });
}

/** Overall run status derived from its asset groups. */
export function deriveRunStatus(groups: AssetGroup[]): MultiAssetPayrollRun["status"] {
  if (groups.length === 0) return "draft";
  const statuses = new Set(groups.map((g) => g.status));

  if (statuses.has("underfunded")) return "underfunded";
  if (statuses.has("executing")) return "executing";

  const allSucceeded = groups.every((g) => g.status === "succeeded");
  if (allSucceeded) return "succeeded";

  const anySucceeded = groups.some((g) => g.status === "succeeded");
  const anyFailed = groups.some((g) => g.status === "failed");
  if (anySucceeded && anyFailed) return "partial";
  if (anyFailed) return "failed";

  if (groups.every((g) => g.status === "funded")) return "ready";
  return "draft";
}

/** Build a reconciliation summary for a completed (or partial) run. */
export function buildReconciliation(run: MultiAssetPayrollRun): MultiAssetReconciliation {
  const groups = run.assetGroups.map((group) => {
    const entries: ReconciliationEntry[] = group.employees.map((emp) => {
      const confirmed = group.status === "succeeded" ? emp.amount : 0;
      return {
        employeeId: emp.employeeId,
        name: emp.name,
        assetCode: group.asset.code,
        expectedAmount: emp.amount,
        confirmedAmount: confirmed,
        status:
          group.status === "succeeded"
            ? "confirmed"
            : group.status === "failed"
            ? "missing"
            : "discrepancy",
        txHash: group.txHash,
        confirmedAt: group.executedAt,
      } satisfies ReconciliationEntry;
    });

    const totalConfirmed = entries.reduce((s, e) => s + e.confirmedAmount, 0);
    const discrepancyCount = entries.filter((e) => e.status !== "confirmed").length;

    return {
      asset: group.asset,
      status:
        group.status === "succeeded"
          ? "complete"
          : group.status === "partial"
          ? "partial"
          : group.status === "failed"
          ? "failed"
          : "pending",
      entries,
      totalExpected: group.totalAmount,
      totalConfirmed,
      discrepancyCount,
    } as MultiAssetReconciliation["groups"][number];
  });

  const canExportAudit = groups.every((g) => g.status === "complete" || g.status === "partial");

  return {
    runId: run.id,
    generatedAt: new Date().toISOString(),
    groups,
    canExportAudit,
  };
}

/** Format a Stellar stroops amount as a human-readable string. */
export function formatAssetAmount(amount: number, assetCode: string): string {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} ${assetCode}`;
}

/** Risk label for a group's status. */
export function groupRiskLabel(group: AssetGroup): string {
  switch (group.status) {
    case "underfunded":
      return `Shortfall: ${formatAssetAmount(group.treasuryReadiness.shortfall, group.asset.code)}`;
    case "failed":
      return group.errorMessage ?? "Execution failed";
    case "partial":
      return "Partially executed";
    default:
      return "";
  }
}
