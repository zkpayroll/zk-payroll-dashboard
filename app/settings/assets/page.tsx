import DashboardLayout from "@/components/layout/DashboardLayout";
import SupportedAssetsEmptyState from "@/components/features/assets/SupportedAssetsEmptyState";
import { SUPPORTED_PAYROLL_ASSETS } from "@/lib/assets/supportedAssets";
import Link from "next/link";
import { Coins, Settings, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Payroll Assets | ZK Payroll",
  description: "Configure supported payroll assets for disbursement.",
};

// Demo: in production this would be fetched from API / company config.
// Empty array simulates "no supported payroll assets configured" — the empty-state path.
// Populate with e.g. [{code:"USDC", issuer:"GA5..."}] to see the configured list.
const DEMO_CONFIGURED_ASSETS: Array<{ code: string; issuer?: string }> = [];

export default function SettingsAssetsPage() {
  const hasAssets = DEMO_CONFIGURED_ASSETS.length > 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Payroll Assets</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Configure which Stellar assets payroll batches can disburse. Supported:{" "}
                {SUPPORTED_PAYROLL_ASSETS.map((a) => a.code).join(", ")}.
              </p>
            </div>
          </div>
        </header>

        {!hasAssets ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <SupportedAssetsEmptyState configuredAssets={DEMO_CONFIGURED_ASSETS} variant="settings" />
            {/* QA steps for success / failure / edge */}
            <div className="mt-6 pt-4 border-t text-xs text-gray-500">
              <h3 className="font-semibold text-gray-700">QA steps</h3>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Success: when assets are configured (e.g. USDC), list shows assets and payroll creation is enabled.</li>
                <li>Failure: when no assets configured, empty state “No supported payroll assets configured” blocks payroll creation with CTA “Add supported asset” → /settings/assets.</li>
                <li>Edge: passing null/undefined treated as empty — same empty state with no crash.</li>
                <li>Privacy: no salary amounts, commitments, or employee PII displayed in empty state.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Coins className="w-4 h-4 text-indigo-600" />
              Configured assets ({DEMO_CONFIGURED_ASSETS.length})
            </div>
            <ul className="divide-y border rounded-lg">
              {DEMO_CONFIGURED_ASSETS.map((asset) => (
                <li key={asset.code} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono font-medium text-gray-900">{asset.code}</p>
                    {asset.issuer && <p className="text-xs font-mono text-gray-500 break-all">{asset.issuer}</p>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Active</span>
                </li>
              ))}
            </ul>
            <Link href="/payroll/create" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Create payroll batch <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900">Supported assets</h2>
          <p className="text-xs text-gray-600 mt-1">
            The dashboard currently supports {SUPPORTED_PAYROLL_ASSETS.length} assets. Unsupported codes will be flagged as invalid.
          </p>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SUPPORTED_PAYROLL_ASSETS.map((asset) => (
              <li key={asset.code} className="border rounded-lg p-3">
                <p className="text-sm font-mono font-medium text-gray-900">{asset.label}</p>
                {asset.issuer ? (
                  <p className="text-xs font-mono text-gray-500 break-all mt-1">{asset.issuer}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">Native Stellar asset</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardLayout>
  );
}
