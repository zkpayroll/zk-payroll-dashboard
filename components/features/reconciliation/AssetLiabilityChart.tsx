import { buildLiabilityBars, hasOutstandingBalance } from "@/lib/charts/liabilityBars";
import { formatAssetAmount } from "@/lib/payroll/multiAsset";
import type { ReconciliationAssetAmount } from "@/lib/sdk/reconciliation";

/**
 * Asset-level liability breakdown, rendered as thin horizontal bars.
 *
 * Every value is a direct text label (never color-only), so the chart
 * reads correctly without relying on hue perception — outstanding balance
 * is additionally called out with a text note, not just a color change.
 */
export function AssetLiabilityChart({ assets }: { assets: ReconciliationAssetAmount[] }) {
  const bars = buildLiabilityBars(assets);

  if (bars.length === 0) {
    return <p className="text-xs text-gray-500">No asset liabilities to display.</p>;
  }

  return (
    <ul className="space-y-3" aria-label="Liability by asset">
      {bars.map((bar) => (
        <li key={bar.key}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-900">{bar.label}</span>
            <span className="text-xs text-gray-600">
              {formatAssetAmount(bar.liability, bar.label)}
              {hasOutstandingBalance(bar) && (
                <span className="text-amber-700">
                  {" "}
                  · {formatAssetAmount(bar.outstanding, bar.label)} outstanding
                </span>
              )}
            </span>
          </div>
          <div
            className="h-2 w-full rounded-full bg-gray-100"
            role="img"
            aria-label={`${bar.label}: ${formatAssetAmount(bar.settled, bar.label)} settled of ${formatAssetAmount(bar.liability, bar.label)} total`}
          >
            <div
              className="h-2 rounded-full"
              style={{ width: `${bar.widthPct}%`, backgroundColor: bar.color.light }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default AssetLiabilityChart;
