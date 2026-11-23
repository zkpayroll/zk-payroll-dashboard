"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Coins, Loader2, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import SupportedAssetsEmptyState from "@/components/features/assets/SupportedAssetsEmptyState";
import {
  SUPPORTED_PAYROLL_ASSETS,
  hasSupportedPayrollAssets,
} from "@/lib/assets/supportedAssets";

export type AssetAllowlistItem = {
  code: string;
  issuer?: string;
  label?: string;
};

const defaultAssets: AssetAllowlistItem[] = SUPPORTED_PAYROLL_ASSETS.map(
  (asset) => ({
    code: asset.code,
    issuer: asset.issuer,
    label: asset.label,
  }),
);

export default function SettingsAssetsPage({
  configuredAssets,
}: {
  configuredAssets?: AssetAllowlistItem[] | null;
}) {
  const [assets, setAssets] = useState<AssetAllowlistItem[]>(
    () => configuredAssets ?? defaultAssets,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let isActive = true;

    const loadAssets = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await new Promise((resolve) => setTimeout(resolve, 250));

        const nextAssets = configuredAssets ?? defaultAssets;

        if (isActive) {
          setAssets(nextAssets);
          setIsLoading(false);
        }
      } catch {
        if (isActive) {
          setError("Unable to load the payroll asset allowlist right now.");
          setIsLoading(false);
        }
      }
    };

    void loadAssets();

    return () => {
      isActive = false;
    };
  }, [configuredAssets, reloadCount]);

  const hasAssets = hasSupportedPayrollAssets(assets);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Coins className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Payroll Assets
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Supported assets used for payroll funding and batch creation.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadCount((count) => count + 1)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div
              className="flex items-center gap-3 text-sm text-slate-600"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading payroll assets...
            </div>
          </div>
        ) : error ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm"
            role="alert"
          >
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5" aria-hidden="true" />
              <div>
                <p className="font-medium">Unable to load asset settings</p>
                <p className="mt-1 text-sm text-red-600">{error}</p>
              </div>
            </div>
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadCount((count) => count + 1)}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Retry
              </Button>
            </div>
          </div>
        ) : !hasAssets ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <SupportedAssetsEmptyState
              configuredAssets={assets}
              variant="settings"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Allowed assets
                </h2>
                <p className="text-sm text-slate-500">
                  {assets.length} asset{assets.length === 1 ? "" : "s"}{" "}
                  currently enabled
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                Active
              </span>
            </div>

            <ul className="space-y-3">
              {assets.map((asset) => (
                <li
                  key={`${asset.code}-${asset.issuer ?? "native"}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {asset.label ?? asset.code}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {asset.code}
                      {asset.issuer ? (
                        <span className="ml-2 break-all font-mono text-slate-500">
                          {asset.issuer}
                        </span>
                      ) : (
                        " · Native Stellar asset"
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                    Active
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Supported asset allowlist
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            The dashboard recognizes the following asset codes as valid payroll
            funding options. Unsupported codes are rejected by payroll
            validation.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {SUPPORTED_PAYROLL_ASSETS.map((asset) => (
              <div
                key={asset.code}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <p className="font-medium text-slate-900">{asset.label}</p>
                <p className="mt-1 text-xs text-slate-500">{asset.code}</p>
                {asset.issuer ? (
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                    {asset.issuer}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Native Stellar asset
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
