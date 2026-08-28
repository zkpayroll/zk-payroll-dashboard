"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { AssetSymbolInput } from "@/components/features/assets/AssetSymbolInput";
import { normalizeAssetSymbol } from "@/lib/assets/normalizeAssetSymbol";
import { Coins, Shield } from "lucide-react";
import Link from "next/link";

export default function PayrollCreatePage() {
  const [assetRaw, setAssetRaw] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = normalizeAssetSymbol(assetRaw);
    if (!result.isValid) {
      setError(result.validationError);
      setSubmitted(null);
      return;
    }
    setError(null);
    // Privacy-safe: only normalized symbol is logged, no amounts
    setSubmitted(result.normalized);
  };

  const result = normalizeAssetSymbol(assetRaw);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <Coins className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Create Payroll Batch</h1>
              <p className="text-sm text-gray-500 mt-0.5">Enter asset details — symbols are normalized for consistency before submission.</p>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          <AssetSymbolInput value={assetRaw} onChange={(raw) => setAssetRaw(raw)} />

          <div className="rounded-lg bg-gray-50 border p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Privacy & validation
            </p>
            <p>Raw input: <span className="font-mono">{assetRaw || "—"}</span></p>
            <p>Normalized: <span className="font-mono font-medium">{result.normalized || "—"}</span></p>
            <p>Validation: {result.isValid ? "✓ valid" : `✗ ${result.validationError}`}</p>
            {result.wasNormalized && <p className="text-amber-700 mt-1">Warning shown: symbol will be normalized before submission.</p>}
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {submitted && (
            <div
              data-testid="payroll-create-success"
              role="status"
              className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800"
            >
              Payroll batch draft created for asset <span className="font-mono font-semibold">{submitted}</span>. Normalized symbol will be used for on-chain submission.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              data-testid="payroll-create-submit"
            >
              Create draft batch
            </button>
            <Link
              href="/payroll/drafts"
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View drafts
            </Link>
          </div>

          <div className="pt-4 border-t text-xs text-gray-500">
            <h3 className="font-semibold text-gray-700">QA steps</h3>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Success: entering &quot; usdc &quot; shows warning &quot;Symbol was trimmed...&quot; and submits as &quot;USDC&quot;.</li>
              <li>Failure: entering &quot;!!!&quot; shows validation error &quot;must be 1-12 alphanumeric&quot;.</li>
              <li>Edge: entering &quot;TEST 123&quot; removes spaces and warns &quot;Spaces were removed&quot;.</li>
              <li>Privacy: no salary or amount is logged or displayed here.</li>
            </ul>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
