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

/**
 * Rounds a single payment amount to the nearest Stellar stroop (#667).
 *
 * Every Stellar asset settles with exactly `STELLAR_ASSET_DECIMALS` (7)
 * decimal places, so a payment amount that arrives with more precision than
 * that (e.g. from a salary split or a percentage-based bonus calculation)
 * cannot actually be paid out as entered — the network rounds it. Rounding
 * each payment independently, rather than rounding only the group total,
 * mirrors how the real dispatch path pays employees one transaction at a
 * time.
 */
export function roundToStroop(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const scale = 10 ** STELLAR_ASSET_DECIMALS;
  return Math.round(amount * scale) / scale;
}

/**
 * Sums a group's per-employee amounts after each is independently rounded
 * to the nearest stroop, and reports the resulting "dust" versus a naive
 * floating-point sum (#667). Used by `buildReconciliation` to distinguish
 * expected rounding dust from an actual missing/mismatched payment.
 */
export function computeRoundingSafeguard(
  amounts: number[],
): { roundedTotal: number; roundingDust: number; roundingDriftExceeded: boolean } {
  const naiveTotal = amounts.reduce((s, a) => s + a, 0);
  const roundedTotal = amounts.reduce((s, a) => s + roundToStroop(a), 0);
  const roundingDust = roundToStroop(roundedTotal - naiveTotal);
  // Bound matches describeAssetRounding's maxDrift (#544): at most half a
  // stroop of drift per payment, accumulated across the group.
  const maxExpectedDrift = (amounts.length * STELLAR_MIN_UNIT) / 2;
  const roundingDriftExceeded = Math.abs(roundingDust) > maxExpectedDrift + STELLAR_MIN_UNIT;
  return { roundedTotal, roundingDust, roundingDriftExceeded };
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

    // Rounding safeguard (#667): computed from *confirmed* amounts, since
    // expected (pre-settlement) amounts haven't gone through the stroop
    // rounding the network actually applies yet.
    const { roundingDust, roundingDriftExceeded } = computeRoundingSafeguard(
      entries.map((e) => e.confirmedAmount),
    );

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
      roundingDust,
      roundingDriftExceeded,
    } as MultiAssetReconciliation["groups"][number];
  });

  // Rounding safeguard (#667): a group whose dust exceeds the expected
  // per-payment stroop bound signals a real arithmetic problem (not benign
  // rounding), so the audit export is blocked until it's investigated —
  // exporting a reconciliation that silently absorbed unexplained drift
  // would defeat the point of an audit trail.
  const canExportAudit = groups.every(
    (g) => (g.status === "complete" || g.status === "partial") && !g.roundingDriftExceeded,
  );

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

/** Every Stellar asset (native XLM and issued assets) has 7 decimal places. */
export const STELLAR_ASSET_DECIMALS = 7;

/** Smallest transferable unit of any Stellar asset (1 stroop). */
export const STELLAR_MIN_UNIT = 1 / 10 ** STELLAR_ASSET_DECIMALS;

export interface AssetRoundingExplanation {
  /** One-line summary suitable for a tooltip heading. */
  summary: string;
  /** Supporting sentences, rendered as separate lines. */
  details: string[];
  /** Largest possible total drift, in asset units (count × ½ stroop). */
  maxDrift: number;
}

/**
 * Plain-language explanation of how a multi-asset group's amounts are rounded
 * (#544). Deliberately derived only from the asset code and the number of
 * payments — never from individual amounts — so the tooltip can't leak
 * salary information.
 */
export function describeAssetRounding(
  assetCode: string,
  paymentCount: number,
): AssetRoundingExplanation {
  const count = Number.isFinite(paymentCount) && paymentCount > 0 ? Math.floor(paymentCount) : 0;
  const maxDrift = (count * STELLAR_MIN_UNIT) / 2;
  const unit = STELLAR_MIN_UNIT.toFixed(STELLAR_ASSET_DECIMALS);

  const details = [
    `${assetCode} amounts settle on Stellar with ${STELLAR_ASSET_DECIMALS} decimal places, so each payment is rounded to the nearest ${unit} ${assetCode}.`,
    "Totals are shown with at least 2 and at most 7 decimals; trailing zeros beyond 2 decimals are hidden.",
  ];
  if (count > 1) {
    details.push(
      `Across ${count} payments the group total may differ from an unrounded or converted figure by at most ${maxDrift.toFixed(STELLAR_ASSET_DECIMALS)} ${assetCode}.`,
    );
  } else if (count === 1) {
    details.push("With a single payment, rounding affects at most half of one stroop.");
  } else {
    details.push("No payments in this group, so no rounding applies.");
  }
  details.push("Each asset is rounded independently; amounts are never converted between assets.");

  return {
    summary: `How ${assetCode} amounts are rounded`,
    details,
    maxDrift,
  };
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
