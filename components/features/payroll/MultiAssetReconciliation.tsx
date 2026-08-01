"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  XCircle,
} from "lucide-react";
import type { MultiAssetReconciliation, ReconciliationEntry } from "@/types/models";
import { assetLabel, formatAssetAmount } from "@/lib/payroll/multiAsset";

// ── Status helpers ────────────────────────────────────────────────────────────

const ENTRY_STATUS_CFG: Record<
  ReconciliationEntry["status"],
  { colorClass: string; label: string; icon: React.ReactNode }
> = {
  confirmed: { colorClass: "text-green-700 bg-green-50", label: "Confirmed", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  discrepancy: { colorClass: "text-orange-700 bg-orange-50", label: "Discrepancy", icon: <AlertCircle className="w-3.5 h-3.5" /> },
  missing: { colorClass: "text-red-700 bg-red-50", label: "Missing", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const GROUP_STATUS_CFG: Record<
  MultiAssetReconciliation["groups"][number]["status"],
  { colorClass: string; label: string }
> = {
  complete: { colorClass: "bg-green-100 text-green-800", label: "Complete" },
  partial: { colorClass: "bg-orange-100 text-orange-800", label: "Partial" },
  failed: { colorClass: "bg-red-100 text-red-800", label: "Failed" },
  pending: { colorClass: "bg-gray-100 text-gray-700", label: "Pending" },
};

// ── Entry row ─────────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: ReconciliationEntry }) {
  const cfg = ENTRY_STATUS_CFG[entry.status];
  const isDiscrepant = entry.status !== "confirmed";

  return (
    <tr className={`text-sm ${isDiscrepant ? "bg-orange-50/40" : ""}`}>
      <td className="px-4 py-2.5 font-medium text-gray-800">{entry.name}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
        {formatAssetAmount(entry.expectedAmount, entry.assetCode)}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
        {entry.confirmedAmount > 0
          ? formatAssetAmount(entry.confirmedAmount, entry.assetCode)
          : "—"}
      </td>
      <td className="px-4 py-2.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.colorClass}`}>
          {cfg.icon} {cfg.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500">
        {entry.txHash ? (
          <span className="font-mono">{entry.txHash.slice(0, 12)}…</span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
        {entry.confirmedAt
          ? new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(
              new Date(entry.confirmedAt),
            )
          : "—"}
      </td>
    </tr>
  );
}

// ── Group panel ───────────────────────────────────────────────────────────────

function GroupPanel({ group }: { group: MultiAssetReconciliation["groups"][number] }) {
  const [collapsed, setCollapsed] = useState(false);
  const cfg = GROUP_STATUS_CFG[group.status];
  const completionPct =
    group.totalExpected > 0
      ? Math.round((group.totalConfirmed / group.totalExpected) * 100)
      : 0;

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <div className="flex items-center gap-3">
          <p className="font-semibold text-gray-900 text-sm">{assetLabel(group.asset)}</p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.colorClass}`}>
            {cfg.label}
          </span>
          {group.discrepancyCount > 0 && (
            <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
              {group.discrepancyCount} discrepanc{group.discrepancyCount !== 1 ? "ies" : "y"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>
            {formatAssetAmount(group.totalConfirmed, group.asset.code)} /{" "}
            {formatAssetAmount(group.totalExpected, group.asset.code)} confirmed ({completionPct}%)
          </span>
          <span className="text-gray-400">{collapsed ? "▸" : "▾"}</span>
        </div>
      </button>

      {/* Completion bar */}
      <div className="h-1 bg-gray-100">
        <div
          className={`h-full transition-all ${
            group.status === "complete"
              ? "bg-green-500"
              : group.status === "failed"
              ? "bg-red-400"
              : "bg-orange-400"
          }`}
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-white">
              <tr>
                {["Employee", "Expected", "Confirmed", "Status", "Tx Hash", "Confirmed At"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {group.entries.map((entry) => (
                <EntryRow key={entry.employeeId} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface MultiAssetReconciliationProps {
  reconciliation: MultiAssetReconciliation;
  onExportAudit?: () => void;
}

export default function MultiAssetReconciliationView({
  reconciliation,
  onExportAudit,
}: MultiAssetReconciliationProps) {
  const totalExpected = reconciliation.groups.reduce((s, g) => s + g.totalExpected, 0);
  const totalConfirmed = reconciliation.groups.reduce((s, g) => s + g.totalConfirmed, 0);
  const totalDiscrepancies = reconciliation.groups.reduce((s, g) => s + g.discrepancyCount, 0);
  const groupsComplete = reconciliation.groups.filter((g) => g.status === "complete").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reconciliation Report</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Run <span className="font-mono">{reconciliation.runId}</span> · Generated{" "}
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(reconciliation.generatedAt),
            )}
          </p>
        </div>
        {reconciliation.canExportAudit && onExportAudit && (
          <button
            onClick={onExportAudit}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-4 py-2
                       text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition"
          >
            <Download className="w-4 h-4" />
            Export audit CSV
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-500">Groups complete</p>
          <p className="text-2xl font-bold text-gray-900">
            {groupsComplete}/{reconciliation.groups.length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-500">Total employees</p>
          <p className="text-2xl font-bold text-gray-900">
            {reconciliation.groups.reduce((s, g) => s + g.entries.length, 0)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-500">Discrepancies</p>
          <p className={`text-2xl font-bold ${totalDiscrepancies > 0 ? "text-red-600" : "text-green-600"}`}>
            {totalDiscrepancies}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-xs text-gray-500">Audit export</p>
          <p className={`text-sm font-semibold mt-1 ${reconciliation.canExportAudit ? "text-green-700" : "text-gray-400"}`}>
            {reconciliation.canExportAudit ? "Ready" : "Not available"}
          </p>
        </div>
      </div>

      {/* Per-group panels */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Per-asset breakdown
        </p>
        {reconciliation.groups.map((group) => (
          <GroupPanel key={group.asset.code} group={group} />
        ))}
      </div>

      {/* Retry guidance for failed groups */}
      {reconciliation.groups.some((g) => g.status === "failed" || g.status === "partial") && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 space-y-2">
          <p className="font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Retry guidance
          </p>
          <ul className="list-disc list-inside space-y-1 text-orange-700">
            <li>Confirm the affected employees&apos; trust lines are established for the failed asset.</li>
            <li>Verify treasury balance covers the shortfall amount.</li>
            <li>Re-run only the failed asset groups — already-confirmed groups will not be re-processed.</li>
            <li>
              For trust-line errors, the employee must accept the asset trust line on-chain before
              retrying.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
