"use client";

import { useEffect, useState } from "react";
import { AssetAllowlistEntry, getAssetAllowlist } from "@/lib/sdk/assets";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export function AssetAllowlist() {
  const [assets, setAssets] = useState<AssetAllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAssetAllowlist();
      setAssets(data);
    } catch (err) {
      setError("Failed to load asset allowlist. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Supported Payroll Assets
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View the assets currently allowed for funding and payroll creation.
          </p>
        </div>
        <button
          onClick={fetchAssets}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                {error}
              </h3>
            </div>
          </div>
        </div>
      )}

      {loading && !error ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : !error && assets.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <AlertCircle className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            No assets configured
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            There are currently no assets in the allowlist. Payroll runs cannot be created until assets are supported.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <ul role="list" className="divide-y divide-slate-200 dark:divide-slate-700">
            {assets.map((asset) => (
              <li key={asset.id} className="p-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {asset.label} ({asset.code})
                      {asset.enabled && (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Enabled
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {asset.issuer ? `Issuer: ${asset.issuer}` : "Native Asset"}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
