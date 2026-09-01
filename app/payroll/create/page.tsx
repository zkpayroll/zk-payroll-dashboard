"use client";

import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { AssetSymbolInput } from "@/components/features/assets/AssetSymbolInput";
import BatchReferenceInput from "@/components/features/payroll/BatchReferenceInput";
import { normalizeAssetSymbol } from "@/lib/assets/normalizeAssetSymbol";
import { validateBatchReferenceWithDuplicateCheck } from "@/lib/validation/batchReference";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import { Coins, Shield } from "lucide-react";
import Link from "next/link";

// Known batch references for duplicate guidance — demo uses mock run ids plus example refs
const KNOWN_BATCH_REFERENCES = [...MOCK_PAYROLL_RUNS.map((r) => r.id), "BATCH-2025-001", "payroll_q1_2025"];

export default function PayrollCreatePage() {
  const [assetRaw, setAssetRaw] = useState("");
  const [batchRef, setBatchRef] = useState("");
  const [submitted, setSubmitted] = useState<{ asset: string; batchRef: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assetResult = normalizeAssetSymbol(assetRaw);
    if (!assetResult.isValid) {
      setError(assetResult.validationError);
      setSubmitted(null);
      return;
    }
    const batchResult = validateBatchReferenceWithDuplicateCheck(batchRef, KNOWN_BATCH_REFERENCES);
    if (!batchResult.isValid) {
      setError(batchResult.message);
      setSubmitted(null);
      return;
    }
    setError(null);
    // Privacy-safe: only normalized asset + batch reference (opaque ID) — no amounts
    setSubmitted({ asset: assetResult.normalized, batchRef: batchResult.normalized });
  };

  const result = normalizeAssetSymbol(assetRaw);
  const batchValidation = useMemo(
    () => validateBatchReferenceWithDuplicateCheck(batchRef, KNOWN_BATCH_REFERENCES),
    [batchRef],
  );

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

          <BatchReferenceInput
            value={batchRef}
            onChange={setBatchRef}
            existingReferences={KNOWN_BATCH_REFERENCES}
            label="External batch reference"
            placeholder="e.g. BATCH-2025-001"
          />

          <div className="rounded-lg bg-gray-50 border p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Privacy & validation
            </p>
            <p>Asset raw: <span className="font-mono">{assetRaw || "—"}</span> → <span className="font-mono font-medium">{result.normalized || "—"}</span> {result.isValid ? "✓" : `✗ ${result.validationError}`} {result.wasNormalized && <span className="text-amber-700">(trimmed/uppercased)</span>}</p>
            <p>Batch ref: <span className="font-mono">{batchRef || "—"}</span> → <span className="font-mono font-medium">{batchValidation.normalized || "—"}</span> {batchValidation.isValid ? "✓ valid" : `✗ ${batchValidation.message}`}</p>
            <p className="text-gray-500 mt-1">Helper copy is shown under each field. Duplicates like <span className="font-mono">BATCH-2025-001</span> or <span className="font-mono">tx_001</span> are flagged before submission.</p>
            {result.wasNormalized && <p className="text-amber-700 mt-1">Asset warning shown: symbol will be normalized before submission.</p>}
          </div>

          {error && (
            <div role="alert" data-testid="payroll-create-error" className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {submitted && (
            <div
              data-testid="payroll-create-success"
              role="status"
              className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800"
            >
              Payroll batch draft created for asset <span className="font-mono font-semibold">{submitted.asset}</span> with reference <span className="font-mono font-semibold">{submitted.batchRef}</span>. Normalized values will be used for on-chain submission.
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
              <li>Asset success: entering &quot; usdc &quot; shows warning &quot;Symbol was trimmed...&quot; and submits as &quot;USDC&quot;.</li>
              <li>Asset failure: entering &quot;!!!&quot; shows validation error &quot;must be 1-12 alphanumeric&quot;.</li>
              <li>Asset edge: entering &quot;TEST 123&quot; removes spaces and warns &quot;Spaces were removed&quot;.</li>
              <li>Batch ref success: entering &quot;BATCH-2025-042&quot; shows helper &quot;3–32 characters...&quot; and submits as-same with ✓.</li>
              <li>Batch ref failure (malformed): entering &quot;!!&quot; or &quot;a&quot; shows &quot;at least 3 characters&quot; / &quot;Invalid batch reference&quot;.</li>
              <li>Batch ref failure (duplicate): entering &quot;BATCH-2025-001&quot; or &quot;tx_001&quot; shows &quot;already in use&quot; — duplicate guidance.</li>
              <li>Batch ref edge: pasting &quot; BATCH 2025 001 &quot; trims whitespace before validation; lowercase &quot;batch-2025-001&quot; flagged as duplicate of existing uppercase variant.</li>
              <li>Privacy: no salary or amount is logged or displayed here — only asset codes and reference IDs.</li>
            </ul>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
