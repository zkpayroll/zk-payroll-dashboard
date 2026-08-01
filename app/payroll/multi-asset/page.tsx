"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  RefreshCw,
  XCircle,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { MOCK_MULTI_ASSET_RUNS } from "@/lib/api/mockData";
import type { MultiAssetPayrollRun } from "@/types/models";
import { formatAssetAmount } from "@/lib/payroll/multiAsset";

const STATUS_CONFIG: Record<
  MultiAssetPayrollRun["status"],
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  draft: { label: "Draft", colorClass: "bg-gray-100 text-gray-700", icon: <Clock className="w-3.5 h-3.5" /> },
  ready: { label: "Ready", colorClass: "bg-blue-100 text-blue-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  underfunded: { label: "Underfunded", colorClass: "bg-yellow-100 text-yellow-800", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  executing: { label: "Executing", colorClass: "bg-blue-100 text-blue-700", icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" /> },
  succeeded: { label: "Succeeded", colorClass: "bg-green-100 text-green-800", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  partial: { label: "Partial", colorClass: "bg-orange-100 text-orange-800", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  failed: { label: "Failed", colorClass: "bg-red-100 text-red-800", icon: <XCircle className="w-3.5 h-3.5" /> },
};

function RunCard({ run }: { run: MultiAssetPayrollRun }) {
  const cfg = STATUS_CONFIG[run.status];
  const assetCodes = run.assetGroups.map((g) => g.asset.code).join(", ");

  return (
    <Link
      href={`/payroll/multi-asset/${run.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md
                 hover:border-indigo-200 transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition">
            {run.label}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {run.totalEmployees} employees · {run.assetGroups.length} asset group
            {run.assetGroups.length !== 1 ? "s" : ""} ({assetCodes})
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.colorClass}`}>
            {cfg.icon} {cfg.label}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition" />
        </div>
      </div>

      {/* Per-asset totals */}
      <div className="mt-3 flex flex-wrap gap-2">
        {run.assetGroups.map((g) => (
          <div
            key={g.asset.code}
            className="flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-3 py-1 text-xs text-gray-700"
          >
            <Coins className="w-3 h-3 text-indigo-400" />
            <span className="font-semibold">{g.asset.code}</span>
            <span className="text-gray-500">{formatAssetAmount(g.totalAmount, g.asset.code)}</span>
            {g.status === "underfunded" && (
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
            )}
            {g.status === "failed" && <XCircle className="w-3 h-3 text-red-500" />}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Created{" "}
        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
          new Date(run.createdAt),
        )}
        {run.executedAt && (
          <>
            {" "}· Executed{" "}
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
              new Date(run.executedAt),
            )}
          </>
        )}
      </p>
    </Link>
  );
}

export default function MultiAssetPayrollListPage() {
  const runs = MOCK_MULTI_ASSET_RUNS;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Multi-Asset Payroll Runs</h1>
            <p className="text-sm text-gray-500 mt-1">
              Plan, review, and reconcile payroll runs that include multiple Stellar assets.
            </p>
          </div>
          <button
            disabled
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white
                       opacity-50 cursor-not-allowed"
            title="New run creation coming soon"
          >
            + New run
          </button>
        </div>

        {/* Underfunded warning banner */}
        {runs.some((r) => r.status === "underfunded") && (
          <div className="mb-4 flex items-start gap-3 rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Action required: </span>
              {runs.filter((r) => r.status === "underfunded").length} run
              {runs.filter((r) => r.status === "underfunded").length !== 1 ? "s are" : " is"}{" "}
              underfunded. Fund the relevant treasury accounts before the next payroll cycle.
            </div>
          </div>
        )}

        <div className="space-y-3">
          {runs.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              No multi-asset payroll runs yet.
            </div>
          ) : (
            runs.map((run) => <RunCard key={run.id} run={run} />)
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
