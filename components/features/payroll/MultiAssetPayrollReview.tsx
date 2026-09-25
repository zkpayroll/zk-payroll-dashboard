"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  RefreshCw,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import type { AssetGroup, MultiAssetPayrollRun } from "@/types/models";
import { assetLabel, formatAssetAmount, groupRiskLabel } from "@/lib/payroll/multiAsset";
import { ProofStatusCard } from "@/components/features/proofs/ProofStatusCard";
import type { ProofLifecycleState } from "@/stores/proofStatus";

// ── Status helpers ────────────────────────────────────────────────────────────

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

const GROUP_STATUS_CONFIG: Record<
  AssetGroup["status"],
  { colorClass: string; icon: React.ReactNode }
> = {
  pending: { colorClass: "bg-gray-100 text-gray-600", icon: <Clock className="w-3 h-3" /> },
  funded: { colorClass: "bg-blue-50 text-blue-700", icon: <CheckCircle2 className="w-3 h-3" /> },
  underfunded: { colorClass: "bg-yellow-50 text-yellow-800", icon: <AlertTriangle className="w-3 h-3" /> },
  executing: { colorClass: "bg-blue-100 text-blue-800", icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  succeeded: { colorClass: "bg-green-50 text-green-800", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { colorClass: "bg-red-50 text-red-800", icon: <XCircle className="w-3 h-3" /> },
  partial: { colorClass: "bg-orange-50 text-orange-800", icon: <AlertTriangle className="w-3 h-3" /> },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TreasuryReadinessBar({ group }: { group: AssetGroup }) {
  const { availableBalance, requiredAmount, isFunded } = group.treasuryReadiness;
  const pct = Math.min((availableBalance / requiredAmount) * 100, 100);

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Treasury readiness</span>
        <span className={isFunded ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
          {formatAssetAmount(availableBalance, group.asset.code)} available /{" "}
          {formatAssetAmount(requiredAmount, group.asset.code)} required
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isFunded ? "bg-green-500" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!isFunded && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" />
          Shortfall of {formatAssetAmount(group.treasuryReadiness.shortfall, group.asset.code)} — fund treasury before submitting
        </p>
      )}
    </div>
  );
}

function AssetGroupCard({ group }: { group: AssetGroup }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = GROUP_STATUS_CONFIG[group.status];
  const riskLabel = groupRiskLabel(group);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50">
            <Coins className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">{assetLabel(group.asset)}</p>
            <p className="text-xs text-gray-500">
              {group.employees.length} employee{group.employees.length !== 1 ? "s" : ""} ·{" "}
              {formatAssetAmount(group.totalAmount, group.asset.code)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.colorClass}`}>
            {cfg.icon}
            {group.status}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
          <TreasuryReadinessBar group={group} />

          {riskLabel && (
            <div className="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {riskLabel}
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Employees</p>
            {group.employees.map((emp) => (
              <div
                key={emp.employeeId}
                className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-none"
              >
                <div>
                  <span className="font-medium text-gray-800">{emp.name}</span>
                  <span className="ml-2 text-xs text-gray-400 font-mono">
                    {emp.address.slice(0, 6)}…{emp.address.slice(-4)}
                  </span>
                </div>
                <span className="font-mono text-xs text-gray-700">
                  {formatAssetAmount(emp.amount, group.asset.code)}
                </span>
              </div>
            ))}
          </div>

          {group.txHash && (
            <p className="text-xs text-gray-500">
              Tx: <span className="font-mono">{group.txHash.slice(0, 16)}…</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface MultiAssetPayrollReviewProps {
  run: MultiAssetPayrollRun;
  onSubmit?: () => void;
  onRetryGroup?: (assetCode: string) => void;
  onRegenerateProof?: () => void;
}

export default function MultiAssetPayrollReview({
  run,
  onSubmit,
  onRetryGroup,
  onRegenerateProof,
}: MultiAssetPayrollReviewProps) {
  const statusCfg = STATUS_CONFIG[run.status];
  const hasFundingIssue = run.assetGroups.some((g) => g.status === "underfunded");
  const hasFailedGroup = run.assetGroups.some((g) => g.status === "failed");
  const canSubmit = run.status === "ready" && run.proofStatus === "ready";

  const totalByAsset = run.assetGroups.map((g) => ({
    assetCode: g.asset.code,
    total: g.totalAmount,
  }));

  // Map run.proofStatus to 7-state lifecycle for card
  const mappedProofState: ProofLifecycleState =
    run.proofStatus === "ready"
      ? "ready"
      : run.proofStatus === "generating"
      ? "generating"
      : run.proofStatus === "expired"
      ? "expired"
      : "queued";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{run.label}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {run.totalEmployees} employees · {run.assetGroups.length} asset group{run.assetGroups.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${statusCfg.colorClass}`}>
          {statusCfg.icon}
          {statusCfg.label}
        </span>
      </div>

      {/* Global warnings */}
      {hasFundingIssue && (
        <div className="flex items-start gap-3 rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">One or more asset groups are underfunded</p>
            <p className="text-yellow-700 mt-0.5">
              Fund all underfunded treasury accounts before submitting. Submitting while underfunded
              will block those groups from executing.
            </p>
          </div>
        </div>
      )}

      {hasFailedGroup && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Partial execution — one or more groups failed</p>
            <p className="text-red-700 mt-0.5">
              Successful groups are shown as Succeeded. Failed groups can be retried individually
              without re-processing already completed payments.
            </p>
          </div>
        </div>
      )}

      {/* Totals summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Total employees</p>
          <p className="text-2xl font-bold text-gray-900 flex items-center gap-1.5">
            <Users className="w-5 h-5 text-indigo-500" />
            {run.totalEmployees}
          </p>
        </div>
        {totalByAsset.map((t) => (
          <div key={t.assetCode} className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">{t.assetCode} total</p>
            <p className="text-lg font-bold text-gray-900 font-mono">
              {formatAssetAmount(t.total, t.assetCode)}
            </p>
          </div>
        ))}
      </div>

      {/* Asset groups */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset Groups</p>
        {run.assetGroups.map((group) => (
          <div key={group.asset.code}>
            <AssetGroupCard group={group} />
            {group.status === "failed" && onRetryGroup && (
              <div className="mt-1 flex justify-end">
                <button
                  onClick={() => onRetryGroup(group.asset.code)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry {group.asset.code} group
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Proof status card integration */}
      <ProofStatusCard
        statusOverride={mappedProofState}
        onRegenerateProof={onRegenerateProof}
        onSubmitTransaction={onSubmit}
      />

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/payroll/multi-asset"
          className="text-sm text-gray-500 hover:text-gray-800 transition"
        >
          ← Back to runs
        </Link>
        <div className="flex items-center gap-3">
          {(run.status === "partial" || run.status === "succeeded") && (
            <Link
              href={`/payroll/multi-asset/${run.id}/reconciliation`}
              className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition"
            >
              View reconciliation
            </Link>
          )}
          {onSubmit && (
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white
                         hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Submit payroll run
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
