"use client";

import { useState } from "react";
import { useParams, notFound } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MultiAssetPayrollReview from "@/components/features/payroll/MultiAssetPayrollReview";
import { MOCK_MULTI_ASSET_RUNS } from "@/lib/api/mockData";
import {
  beginPartialGroupRetry,
  completePartialGroupRetry,
} from "@/lib/payroll/partialBatchRecovery";

export default function MultiAssetPayrollDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const [runs, setRuns] = useState(MOCK_MULTI_ASSET_RUNS);

  const run = runs.find((r) => r.id === runId);
  if (!run) return notFound();

  const handleSubmit = () => {
    setRuns((prev) =>
      prev.map((r) =>
        r.id === runId
          ? {
              ...r,
              status: "executing",
              assetGroups: r.assetGroups.map((g) => ({ ...g, status: "executing" })),
            }
          : r,
      ),
    );
    // In production this would call the API and then poll for status.
    setTimeout(() => {
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? {
                ...r,
                status: "succeeded",
                executedAt: new Date().toISOString(),
                assetGroups: r.assetGroups.map((g) => ({
                  ...g,
                  status: "succeeded",
                  txHash: `sim_${g.asset.code}_${Date.now()}`,
                  executedAt: new Date().toISOString(),
                })),
              }
            : r,
        ),
      );
    }, 2500);
  };

  const handleRetryGroup = (assetCode: string) => {
    setRuns((prev) =>
      prev.map((r) =>
        r.id === runId
          ? beginPartialGroupRetry(r, assetCode)
          : r,
      ),
    );
    setTimeout(() => {
      const executedAt = new Date().toISOString();
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? completePartialGroupRetry(r, assetCode, `retry_${assetCode}_${Date.now()}`, executedAt)
            : r,
        ),
      );
    }, 2500);
  };

  const currentRun = runs.find((r) => r.id === runId)!;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <MultiAssetPayrollReview
          run={currentRun}
          onSubmit={handleSubmit}
          onRetryGroup={handleRetryGroup}
        />
      </div>
    </DashboardLayout>
  );
}
