import type { AssetGroup, StellarAsset } from "@/types/models";
import { assetLabel } from "@/lib/payroll/multiAsset";

/**
 * Per-asset funding readiness (#337). Payroll is only as ready as its least
 * funded asset: a surplus in one asset must never hide a deficit in another.
 */
export type AssetFundingState = "deficit" | "reserved" | "balanced" | "surplus";

export function assetKeyOf(asset: StellarAsset): string {
  return asset.issuer ? `${asset.code}:${asset.issuer}` : asset.code;
}

export interface AssetFundingPosition {
  /** Stable key combining code and issuer. */
  key: string;
  label: string;
  required: number;
  available: number;
  /** Amounts earmarked by other in-flight runs; reduces the free balance. */
  reserved: number;
  surplus: number;
  deficit: number;
  state: AssetFundingState;
  /** Deficits block payroll execution until funded. */
  isBlocking: boolean;
}

export interface FundingImbalanceSummary {
  positions: Array<AssetFundingPosition>;
  totalRequired: number;
  totalAvailable: number;
  totalReserved: number;
  totalSurplus: number;
  totalDeficit: number;
  blockingAssets: Array<AssetFundingPosition>;
  isPayrollBlocked: boolean;
}

/**
 * Aggregate draft payroll groups into per-asset funding positions.
 *
 * `reservedByAsset` maps an asset key (`CODE` or `CODE:issuer`) to amounts
 * already earmarked elsewhere, so a treasury can look liquid overall while
 * still being short for this specific run.
 */
export function computeFundingPositions(
  groups: AssetGroup[],
  reservedByAsset?: Record<string, number>,
): FundingImbalanceSummary {
  const byKey = new Map<string, { label: string; required: number; available: number }>();

  for (const group of groups) {
    const key = assetKeyOf(group.asset);
    const existing = byKey.get(key);
    const entry =
      existing ??
      {
        // Treasury availability is per-asset, so repeated groups share it —
        // keep the first reading instead of summing balances twice.
        label: assetLabel(group.asset),
        required: 0,
        available: group.treasuryReadiness.availableBalance,
      };
    entry.required += group.treasuryReadiness.requiredAmount;
    byKey.set(key, entry);
  }

  const positions: Array<AssetFundingPosition> = Array.from(byKey.entries()).map(
    ([key, entry]) => {
      const reserved = Math.max(0, reservedByAsset?.[key] ?? 0);
      const effective = entry.available - reserved;
      const deficit = Math.max(0, entry.required - effective);
      const surplus = Math.max(0, effective - entry.required);

      let state: AssetFundingState;
      if (deficit > 0) state = "deficit";
      else if (reserved > 0) state = "reserved";
      else if (surplus > 0) state = "surplus";
      else state = "balanced";

      return {
        key,
        label: entry.label,
        required: entry.required,
        available: entry.available,
        reserved,
        surplus,
        deficit,
        state,
        isBlocking: deficit > 0,
      };
    },
  );

  const totalRequired = positions.reduce((s, p) => s + p.required, 0);
  const totalAvailable = positions.reduce((s, p) => s + p.available, 0);
  const totalReserved = positions.reduce((s, p) => s + p.reserved, 0);
  const totalSurplus = positions.reduce((s, p) => s + p.surplus, 0);
  const totalDeficit = positions.reduce((s, p) => s + p.deficit, 0);

  return {
    positions,
    totalRequired,
    totalAvailable,
    totalReserved,
    totalSurplus,
    totalDeficit,
    blockingAssets: positions.filter((p) => p.isBlocking),
    isPayrollBlocked: positions.some((p) => p.isBlocking),
  };
}
