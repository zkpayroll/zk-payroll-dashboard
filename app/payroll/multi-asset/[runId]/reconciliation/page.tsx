"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MultiAssetReconciliationView from "@/components/features/payroll/MultiAssetReconciliation";
import { MOCK_MULTI_ASSET_RUNS } from "@/lib/api/mockData";
import { buildReconciliation } from "@/lib/payroll/multiAsset";

export default function MultiAssetReconciliationPage() {
  const { runId } = useParams<{ runId: string }>();
  const run = MOCK_MULTI_ASSET_RUNS.find((r) => r.id === runId);

  if (!run) return notFound();

  // Only runs that have finished execution (partial or succeeded) have
  // reconciliation data.  Draft / underfunded runs redirect back to review.
  if (run.status === "draft" || run.status === "ready" || run.status === "underfunded") {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500 text-sm">
          <p className="font-medium text-gray-700 mb-2">Reconciliation not yet available</p>
          <p>This run has not been executed yet. Submit it first to generate a reconciliation report.</p>
          <Link
            href={`/payroll/multi-asset/${runId}`}
            className="mt-4 inline-block text-indigo-600 hover:underline text-sm font-medium"
          >
            ← Back to run review
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const reconciliation = useMemo(() => buildReconciliation(run), [run]);

  const handleExportAudit = () => {
    // Build CSV
    const rows: string[] = [
      "Asset,Employee,Expected,Confirmed,Status,TxHash,ConfirmedAt",
    ];
    for (const group of reconciliation.groups) {
      for (const entry of group.entries) {
        rows.push(
          [
            group.asset.code,
            entry.name,
            entry.expectedAmount,
            entry.confirmedAmount,
            entry.status,
            entry.txHash ?? "",
            entry.confirmedAt ?? "",
          ].join(","),
        );
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${run.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4">
          <Link
            href={`/payroll/multi-asset/${runId}`}
            className="text-sm text-gray-500 hover:text-gray-800 transition"
          >
            ← Back to run review
          </Link>
        </div>
        <MultiAssetReconciliationView
          reconciliation={reconciliation}
          onExportAudit={reconciliation.canExportAudit ? handleExportAudit : undefined}
        />
      </div>
    </DashboardLayout>
  );
}
