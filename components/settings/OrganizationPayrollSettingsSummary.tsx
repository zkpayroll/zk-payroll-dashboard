"use client";

import { useMemo } from "react";
import {
  ShieldCheck,
  Globe,
  Coins,
  Building2,
  Users,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import type { CompanyConfig } from "@/types";
import { buildOrganizationPayrollSettingsSummary } from "@/src/settings/summary";

export interface OrganizationPayrollSettingsSummaryProps {
  config?: CompanyConfig | null;
}

export function OrganizationPayrollSettingsSummary({
  config,
}: OrganizationPayrollSettingsSummaryProps) {
  const summary = useMemo(
    () => buildOrganizationPayrollSettingsSummary(config),
    [config],
  );

  return (
    <div
      className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-200"
      data-testid="org-payroll-settings-summary"
    >
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              <h2 className="text-xl font-bold text-gray-900">
                {summary.companyName}
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  summary.isConfigured
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {summary.isConfigured ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Configured
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    Action Required
                  </>
                )}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Read-only organization-level payroll settings overview.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-md text-xs text-gray-600 font-medium self-start sm:self-auto">
            <Lock className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
            Read-Only Summary
          </div>
        </div>

        {/* Warnings */}
        {summary.warnings.length > 0 && (
          <div
            className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1"
            role="alert"
          >
            {summary.warnings.map((warning, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Network & Contracts Section */}
        <div
          className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4"
          data-testid="settings-section-network"
        >
          <div className="flex items-center gap-2 border-b pb-3">
            <Globe className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-gray-900">
              Network & Soroban Contracts
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Stellar Network</span>
              <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                {summary.network.network}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Registry Contract</span>
              <span className="font-mono text-gray-700 truncate max-w-[200px]" title={summary.network.registryContract}>
                {summary.network.registryContract}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Verifier Contract</span>
              <span className="font-mono text-gray-700 truncate max-w-[200px]" title={summary.network.verifierContract}>
                {summary.network.verifierContract}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Executor Contract</span>
              <span className="font-mono text-gray-700 truncate max-w-[200px]" title={summary.network.executorContract}>
                {summary.network.executorContract}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Audit Contract</span>
              <span className="font-mono text-gray-700 truncate max-w-[200px]" title={summary.network.auditContract}>
                {summary.network.auditContract}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Commitment Contract</span>
              <span className="font-mono text-gray-700 truncate max-w-[200px]" title={summary.network.commitmentContract}>
                {summary.network.commitmentContract}
              </span>
            </div>
          </div>
        </div>

        {/* Treasury Section */}
        <div
          className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4"
          data-testid="settings-section-treasury"
        >
          <div className="flex items-center gap-2 border-b pb-3">
            <Building2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-gray-900">
              Treasury Account
            </h3>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Account Status</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold capitalize ${
                  summary.treasury.status === "linked"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {summary.treasury.status}
              </span>
            </div>
            <div className="py-1">
              <span className="text-gray-500 block mb-1">Treasury Stellar Address</span>
              <span
                className="font-mono text-gray-800 bg-gray-50 p-2 rounded block break-all text-[11px]"
                data-testid="treasury-address"
              >
                {summary.treasury.accountAddress}
              </span>
            </div>
          </div>
        </div>

        {/* Assets Section */}
        <div
          className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4"
          data-testid="settings-section-assets"
        >
          <div className="flex items-center gap-2 border-b pb-3">
            <Coins className="w-4 h-4 text-amber-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-gray-900">
              Disbursement Assets
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            {summary.assets.map((asset) => (
              <div
                key={asset.code}
                className="flex items-center justify-between p-2 rounded bg-gray-50"
              >
                <div>
                  <span className="font-semibold text-gray-900">{asset.code}</span>
                  {asset.contractId && (
                    <span className="block text-[10px] font-mono text-gray-400 truncate max-w-[180px]">
                      {asset.contractId}
                    </span>
                  )}
                </div>
                {asset.isDefault && (
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                    Default Asset
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Roles & Audit Settings */}
        <div
          className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4"
          data-testid="settings-section-audit"
        >
          <div className="flex items-center gap-2 border-b pb-3">
            <FileCheck className="w-4 h-4 text-blue-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-gray-900">
              Audit & Compliance Settings
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Audit Logging</span>
              <span className="font-semibold text-gray-900">
                {summary.audit.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-500">Retention Period</span>
              <span className="font-semibold text-gray-900">
                {summary.audit.retentionDays} days
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Require Auditor Approval</span>
              <span className="font-semibold text-gray-900">
                {summary.audit.requireAuditorApproval ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrganizationPayrollSettingsSummary;
