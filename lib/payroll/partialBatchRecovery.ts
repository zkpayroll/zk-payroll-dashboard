import type { MultiAssetPayrollRun } from "@/types/models";
import { deriveRunStatus } from "@/lib/payroll/multiAsset";

/** Move one failed asset group into retry without resetting reviewed groups. */
export function beginPartialGroupRetry(
  run: MultiAssetPayrollRun,
  assetCode: string,
): MultiAssetPayrollRun {
  const target = run.assetGroups.find((group) => group.asset.code === assetCode);
  if (!target || (target.status !== "failed" && target.status !== "partial")) {
    return run;
  }

  const assetGroups = run.assetGroups.map((group) =>
    group.asset.code === assetCode ? { ...group, status: "executing" as const } : group,
  );
  return { ...run, status: deriveRunStatus(assetGroups), assetGroups };
}

/** Complete one retry while retaining every other group's review/result state. */
export function completePartialGroupRetry(
  run: MultiAssetPayrollRun,
  assetCode: string,
  txHash: string,
  executedAt: string,
): MultiAssetPayrollRun {
  const target = run.assetGroups.find((group) => group.asset.code === assetCode);
  if (!target || target.status !== "executing") return run;

  const assetGroups = run.assetGroups.map((group) =>
    group.asset.code === assetCode
      ? { ...group, status: "succeeded" as const, txHash, executedAt }
      : group,
  );
  const status = deriveRunStatus(assetGroups);
  return {
    ...run,
    status,
    assetGroups,
    ...(status === "succeeded" ? { executedAt } : {}),
  };
}
