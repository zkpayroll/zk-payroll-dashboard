import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  formatSupportedAssetsList,
  getUnsupportedAssets,
  hasSupportedPayrollAssets,
} from "@/lib/assets/supportedAssets";

export interface DashboardAssetAvailabilityCheckProps {
  configuredAssets?: Array<{ code: string; issuer?: string }> | null;
}

/** A privacy-safe dashboard check that confirms payroll has a supported asset. */
export default function DashboardAssetAvailabilityCheck({
  configuredAssets,
}: DashboardAssetAvailabilityCheckProps) {
  const isAvailable = hasSupportedPayrollAssets(configuredAssets);
  const unsupportedAssets = getUnsupportedAssets(configuredAssets);

  return (
    <section
      aria-labelledby="dashboard-asset-availability-heading"
      className={`rounded-lg border p-4 ${
        isAvailable
          ? "border-green-200 bg-green-50"
          : "border-amber-200 bg-amber-50"
      }`}
      data-testid="dashboard-asset-availability"
      data-status={isAvailable ? "available" : "unavailable"}
    >
      <div className="flex items-start gap-3">
        {isAvailable ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <h3 id="dashboard-asset-availability-heading" className="text-sm font-semibold text-gray-900">
            Payroll asset availability
          </h3>
          {isAvailable ? (
            <p className="mt-1 text-sm text-green-800">
              Supported payroll assets are configured ({formatSupportedAssetsList()}).
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-amber-800">
                Payroll creation is blocked until a supported asset ({formatSupportedAssetsList()}) is configured.
              </p>
              {unsupportedAssets.length > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Unsupported assets ignored: {unsupportedAssets.join(", ")}.
                </p>
              )}
              <Link
                href="/settings/assets"
                className="mt-2 inline-flex text-sm font-medium text-amber-900 underline hover:text-amber-700"
              >
                Configure payroll assets
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
