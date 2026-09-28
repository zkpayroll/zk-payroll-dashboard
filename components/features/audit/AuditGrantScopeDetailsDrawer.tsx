"use client";

import React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Lock,
  X,
  UserCheck,
  Eye,
  Ban,
  Download,
  Calendar,
  Key,
  Building2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export interface AuditGrantScopeItem {
  id: string;
  name: string;
  description: string;
  category: "reads" | "verification" | "export" | "restricted";
  isGranted: boolean;
}

export interface AuditGrantDetail {
  id: string;
  auditorName: string;
  auditorOrg: string;
  auditorAddress: string;
  grantedBy: string;
  createdAt: string;
  expiresAt: string;
  status: "active" | "expiring_soon" | "expired" | "revoked";
  maskingTier: "ANONYMIZED_ONLY" | "PARTIALLY_MASKED" | "FULL_ZERO_KNOWLEDGE";
  accessibleScopes: AuditGrantScopeItem[];
  restrictedScopes: AuditGrantScopeItem[];
}

export interface AuditGrantScopeDetailsDrawerProps {
  isOpen: boolean;
  grant?: AuditGrantDetail;
  onClose: () => void;
  onExtendGrant?: (grantId: string) => void;
  onRevokeGrant?: (grantId: string) => void;
  onExportScope?: (grant: AuditGrantDetail) => void;
  className?: string;
}

const DEFAULT_GRANT: AuditGrantDetail = {
  id: "grant_audit_991823",
  auditorName: "External Compliance Auditor",
  auditorOrg: "Deloitte Node Audit Team",
  auditorAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  grantedBy: "Operator Admin (0x8920...)",
  createdAt: "2026-09-01T10:00:00Z",
  expiresAt: "2026-10-01T10:00:00Z",
  status: "active",
  maskingTier: "FULL_ZERO_KNOWLEDGE",
  accessibleScopes: [
    {
      id: "scope_read_payroll_runs",
      name: "READ_PAYROLL_RUNS",
      description: "View encrypted payroll run metadata, batch timestamps, and status logs.",
      category: "reads",
      isGranted: true,
    },
    {
      id: "scope_read_reconciliation",
      name: "READ_RECONCILIATION_LOGS",
      description: "Access multi-asset ledger reconciliation reports and balance diffs.",
      category: "reads",
      isGranted: true,
    },
    {
      id: "scope_read_amendments",
      name: "READ_AMENDMENT_HISTORY",
      description: "Inspect safe commitment revision histories and version numbers.",
      category: "reads",
      isGranted: true,
    },
    {
      id: "scope_verify_zk_proofs",
      name: "VERIFY_ZK_PROOFS",
      description: "Run off-chain zero-knowledge circuit verification on proof hashes.",
      category: "verification",
      isGranted: true,
    },
    {
      id: "scope_export_evidence",
      name: "EXPORT_COMPLIANCE_EVIDENCE",
      description: "Download signed compliance evidence bundles and audit certificates.",
      category: "export",
      isGranted: true,
    },
  ],
  restrictedScopes: [
    {
      id: "scope_view_raw_salaries",
      name: "VIEW_UNMASKED_SALARIES",
      description: "Prohibited: Raw salary amounts and employee financial compensation numbers.",
      category: "restricted",
      isGranted: false,
    },
    {
      id: "scope_modify_payroll",
      name: "MODIFY_PAYROLL_DATA",
      description: "Prohibited: Editing payroll runs, commitments, or employee records.",
      category: "restricted",
      isGranted: false,
    },
    {
      id: "scope_execute_disbursement",
      name: "EXECUTE_DISBURSEMENT",
      description: "Prohibited: Signing or broadcasting payout transactions.",
      category: "restricted",
      isGranted: false,
    },
  ],
};

export function AuditGrantScopeDetailsDrawer({
  isOpen,
  grant = DEFAULT_GRANT,
  onClose,
  onExtendGrant,
  onRevokeGrant,
  onExportScope,
  className = "",
}: AuditGrantScopeDetailsDrawerProps) {
  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3" /> ACTIVE GRANT
          </span>
        );
      case "expiring_soon":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" /> EXPIRING SOON
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
            <Clock className="w-3 h-3" /> EXPIRED
          </span>
        );
      case "revoked":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            <Ban className="w-3 h-3" /> REVOKED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 capitalize">
            {status}
          </span>
        );
    }
  };

  const handleExport = () => {
    if (onExportScope) {
      onExportScope(grant);
      return;
    }
    const blob = new Blob([JSON.stringify(grant, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-grant-scope-${grant.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid="audit-grant-scope-drawer"
      className="fixed inset-0 bg-black/50 z-50 flex justify-end"
    >
      <div
        className={`bg-white w-full max-w-xl h-full p-6 space-y-6 overflow-y-auto shadow-2xl flex flex-col justify-between ${className}`}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Audit Grant Scope Details</h2>
                <p className="text-xs text-gray-500">
                  Granular permissions, access limits, and expiration metadata for third-party auditor.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              data-testid="close-drawer-btn"
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Auditor Identity Header Card */}
          <div
            data-testid="auditor-identity-header"
            className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-gray-900">{grant.auditorName}</h3>
              </div>
              <div data-testid="grant-expiry-indicator">{getStatusBadge(grant.status)}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200 text-gray-600">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <span>Organization: <strong className="text-gray-900">{grant.auditorOrg}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Key className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="truncate font-mono">Address: {grant.auditorAddress}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>Granted: {new Date(grant.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>Expires: {new Date(grant.expiresAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Masking Tier Badge */}
          <div className="flex items-center justify-between p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span className="font-semibold text-indigo-900">Privacy & Data Masking Tier:</span>
            </div>
            <span
              data-testid="masking-tier-badge"
              className="px-2.5 py-0.5 rounded-full font-extrabold bg-indigo-600 text-white text-[11px]"
            >
              {grant.maskingTier.replace(/_/g, " ")}
            </span>
          </div>

          {/* Accessible Scopes */}
          <div data-testid="grant-accessible-scopes" className="space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Accessible Scopes ({grant.accessibleScopes.length})
              </h3>
            </div>

            <div className="space-y-2">
              {grant.accessibleScopes.map((scope) => (
                <div
                  key={scope.id}
                  className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/40 text-xs space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-emerald-950 font-mono">{scope.name}</span>
                  </div>
                  <p className="text-gray-600 pl-6">{scope.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Restricted Scopes */}
          <div data-testid="grant-restricted-scopes" className="space-y-3">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-600" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Prohibited / Restricted Scopes ({grant.restrictedScopes.length})
              </h3>
            </div>

            <div className="space-y-2">
              {grant.restrictedScopes.map((scope) => (
                <div
                  key={scope.id}
                  className="p-3 rounded-lg border border-red-100 bg-red-50/40 text-xs space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="font-bold text-red-950 font-mono">{scope.name}</span>
                  </div>
                  <p className="text-red-800 pl-6">{scope.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Zero Knowledge Safeguard Banner */}
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>ZK Safeguard Enforcement:</strong> Grantee view keys provide cryptographic proofs of correctness without leaking individual recipient salaries or secret commitments.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleExport}
            data-testid="export-scope-btn"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export Scope
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onExtendGrant && (
              <button
                type="button"
                onClick={() => onExtendGrant(grant.id)}
                data-testid="extend-grant-btn"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Extend Grant
              </button>
            )}

            {onRevokeGrant && (
              <button
                type="button"
                onClick={() => onRevokeGrant(grant.id)}
                data-testid="revoke-grant-btn"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
              >
                <Ban className="w-3.5 h-3.5" /> Revoke Grant
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditGrantScopeDetailsDrawer;
