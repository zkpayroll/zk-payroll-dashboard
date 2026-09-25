import { AlertTriangle, CheckCircle2 } from "lucide-react";

export interface AssetReadinessRow {
  assetCode: string;
  availableBalance: number;
  reserveThreshold: number;
  lastRefresh: string;
  warning?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AssetReadinessTable({
  rows,
}: {
  rows?: AssetReadinessRow[];
}) {
  const data = rows ?? [];

  return (
    <section
      aria-labelledby="asset-readiness-heading"
      className="bg-white rounded-lg shadow-sm overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 id="asset-readiness-heading" className="text-base font-semibold text-gray-900">
          Asset Ready State
        </h3>
      </div>

      {data.length === 0 ? (
        <div className="px-6 py-8 text-sm text-gray-500">No supported payroll assets configured.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <caption className="sr-only">Supported payroll asset readiness</caption>
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Asset
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Available Balance
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Reserve Warning
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Last Refresh
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row) => {
                const warningText = row.warning ?? (row.availableBalance >= row.reserveThreshold
                  ? "Above reserve threshold"
                  : "Below reserve threshold");
                const isWarning = warningText.toLowerCase().includes("below");

                return (
                  <tr key={row.assetCode}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isWarning ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                        )}
                        <span className="text-sm font-medium text-gray-900">{row.assetCode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 tabular-nums">
                      {formatCurrency(row.availableBalance)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={
                          isWarning
                            ? "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
                            : "inline-flex rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                        }
                      >
                        {warningText}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatTimestamp(row.lastRefresh)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
