/**
 * Pure chart-data preparation for reconciliation liability bars.
 *
 * No rendering here — this only turns aggregate asset amounts into
 * bar-ready data (percentage widths, a fixed categorical color per asset).
 * Rendering lives in `components/features/reconciliation/AssetLiabilityChart.tsx`.
 *
 * Colors are assigned in a fixed order (never cycled/re-assigned based on
 * filtering) using the dataviz-skill validated categorical triple —
 * distinct under both normal and color-vision-deficient vision. Assets
 * beyond the fixed order fold into a neutral "other" slot rather than
 * generating a new hue.
 */

import type { ReconciliationAssetAmount } from "@/lib/sdk/reconciliation";
import { SUPPORTED_PAYROLL_ASSETS } from "@/lib/assets/supportedAssets";

/** Fixed categorical order + validated colors (light/dark), one per supported asset. */
const ASSET_COLOR_ORDER: Record<string, { light: string; dark: string }> = {
  USDC: { light: "#2a78d6", dark: "#3987e5" }, // blue
  XLM: { light: "#eb6834", dark: "#d95926" }, // orange
  EURC: { light: "#1baf7a", dark: "#199e70" }, // aqua
};

const OTHER_COLOR = { light: "#6b7280", dark: "#9ca3af" }; // neutral gray

export interface LiabilityBar {
  key: string;
  label: string;
  liability: number;
  settled: number;
  outstanding: number;
  /** 0-100, relative to the largest liability in the set. */
  widthPct: number;
  color: { light: string; dark: string };
}

/** True when a bar has any unsettled balance — used to add a non-color visual cue. */
export function hasOutstandingBalance(bar: Pick<LiabilityBar, "outstanding">): boolean {
  return bar.outstanding > 0;
}

/**
 * Build bar-ready data from per-asset liability totals. Sorted by the
 * app's canonical supported-asset order (falling back to alphabetical
 * for anything unrecognized) so color assignment never depends on the
 * order the data happened to arrive in.
 */
export function buildLiabilityBars(assets: ReconciliationAssetAmount[]): LiabilityBar[] {
  const canonicalOrder = SUPPORTED_PAYROLL_ASSETS.map((a) => a.code);
  const sorted = [...assets].sort((a, b) => {
    const rankA = canonicalOrder.indexOf(a.asset.code);
    const rankB = canonicalOrder.indexOf(b.asset.code);
    if (rankA !== -1 && rankB !== -1) return rankA - rankB;
    if (rankA !== -1) return -1;
    if (rankB !== -1) return 1;
    return a.asset.code.localeCompare(b.asset.code);
  });

  const maxLiability = Math.max(1, ...sorted.map((a) => a.liability));

  return sorted.map((entry) => ({
    key: entry.asset.issuer ? `${entry.asset.code}:${entry.asset.issuer}` : entry.asset.code,
    label: entry.asset.code,
    liability: entry.liability,
    settled: entry.settled,
    outstanding: entry.outstanding,
    widthPct: Math.round((entry.liability / maxLiability) * 100),
    color: ASSET_COLOR_ORDER[entry.asset.code] ?? OTHER_COLOR,
  }));
}
