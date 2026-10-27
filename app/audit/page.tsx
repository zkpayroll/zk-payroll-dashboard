"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Key,
  Ban,
  Download,
  Filter,
  Search,
  Building2,
  Lock,
  ChevronRight,
  Info,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  AuditGrantScopeDetailsDrawer,
  type AuditGrantDetail,
} from "@/components/features/audit/AuditGrantScopeDetailsDrawer";
import {
  AuditGrantRevocationStatus,
  formatRevocationTimestamp,
} from "@/components/features/audit/AuditGrantRevocationStatus";
import { MOCK_ARCHIVED_RUNS } from "@/stores/archive";
import { evaluateAuditorArchivedPeriodAccess } from "@/lib/audit/archivedPeriodAccess";

// Initial seeded audit grants for operators and integrators
export const MOCK_AUDIT_GRANTS: AuditGrantDetail[] = [
  {
    id: "grant_audit_991823",
    auditorName: "External Compliance Auditor",
    auditorOrg: "Deloitte Node Audit Team",
    auditorAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    grantedBy: "Operator Admin (0x8920...)",
    createdAt: "2026-09-01T10:00:00Z",
    expiresAt: "2026-12-01T10:00:00Z",
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
    ],
  },
  {
    id: "grant_audit_882041",
    auditorName: "PwC Financial Verification",
    auditorOrg: "PricewaterhouseCoopers LLP",
    auditorAddress: "0x34A89b61dCDe4f5869B37E4a1F9915F6d8234B",
    grantedBy: "Security Lead (0x4421...)",
    createdAt: "2026-08-15T08:30:00Z",
    expiresAt: "2026-09-15T08:30:00Z",
    status: "revoked",
    revokedAt: "2026-09-10T14:45:00Z",
    revokedBy: "Security Compliance Officer (0x4421...)",
    revocationReason: "Routine audit cycle concluded; access key rotated per protocol.",
    maskingTier: "FULL_ZERO_KNOWLEDGE",
    accessibleScopes: [
      {
        id: "scope_read_payroll_runs",
        name: "READ_PAYROLL_RUNS",
        description: "View encrypted payroll run metadata and batch status.",
        category: "reads",
        isGranted: true,
      },
      {
        id: "scope_read_reconciliation",
        name: "READ_RECONCILIATION_LOGS",
        description: "Access multi-asset ledger reconciliation reports.",
        category: "reads",
        isGranted: true,
      },
    ],
    restrictedScopes: [
      {
        id: "scope_view_raw_salaries",
        name: "VIEW_UNMASKED_SALARIES",
        description: "Prohibited: Raw salary amounts and financial compensation.",
        category: "restricted",
        isGranted: false,
      },
      {
        id: "scope_modify_payroll",
        name: "MODIFY_PAYROLL_DATA",
        description: "Prohibited: Editing payroll runs or employee records.",
        category: "restricted",
        isGranted: false,
      },
    ],
  },
  {
    id: "grant_audit_773912",
    auditorName: "Ernst & Young ZK Assurance",
    auditorOrg: "EY Blockchain Practice",
    auditorAddress: "0x98EF71c890ab88c098defB751B7401B5f6d89999",
    grantedBy: "Operator Admin (0x8920...)",
    createdAt: "2026-07-01T12:00:00Z",
    expiresAt: "2026-08-01T12:00:00Z",
    status: "revoked",
    revokedAt: "2026-07-28T16:20:00Z",
    revokedBy: "Compliance Director",
    revocationReason: "Early termination upon quarterly review completion.",
    maskingTier: "FULL_ZERO_KNOWLEDGE",
    accessibleScopes: [
      {
        id: "scope_verify_zk_proofs",
        name: "VERIFY_ZK_PROOFS",
        description: "Circuit proof verification for state transitions.",
        category: "verification",
        isGranted: true,
      },
    ],
    restrictedScopes: [
      {
        id: "scope_view_raw_salaries",
        name: "VIEW_UNMASKED_SALARIES",
        description: "Prohibited: Raw individual salary figures.",
        category: "restricted",
        isGranted: false,
      },
    ],
  },
  {
    id: "grant_audit_664120",
    auditorName: "KPMG Regulatory Inspector",
    auditorOrg: "KPMG Audit Services",
    auditorAddress: "0x12C7656EC7ab88b098defB751B7401B5f6d81111",
    grantedBy: "Operator Admin (0x8920...)",
    createdAt: "2026-10-01T09:00:00Z",
    expiresAt: "2026-10-25T09:00:00Z",
    status: "expiring_soon",
    maskingTier: "FULL_ZERO_KNOWLEDGE",
    accessibleScopes: [
      {
        id: "scope_read_payroll_runs",
        name: "READ_PAYROLL_RUNS",
        description: "Encrypted payroll run verification.",
        category: "reads",
        isGranted: true,
      },
    ],
    restrictedScopes: [
      {
        id: "scope_view_raw_salaries",
        name: "VIEW_UNMASKED_SALARIES",
        description: "Prohibited: View unmasked salaries.",
        category: "restricted",
        isGranted: false,
      },
    ],
  },
];

export default function AuditGrantsPage() {
  const [grants, setGrants] = useState<AuditGrantDetail[]>(MOCK_AUDIT_GRANTS);
  const [selectedGrant, setSelectedGrant] = useState<AuditGrantDetail | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleOpenDrawer = (grant: AuditGrantDetail) => {
    setSelectedGrant(grant);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedGrant(null);
  };

  const handleRevokeGrant = (grantId: string) => {
    const now = new Date().toISOString();
    setGrants((prev) =>
      prev.map((g) =>
        g.id === grantId
          ? {
              ...g,
              status: "revoked",
              revokedAt: now,
              revokedBy: "Current Operator",
              revocationReason: "Revoked manually by operator.",
            }
          : g,
      ),
    );

    if (selectedGrant && selectedGrant.id === grantId) {
      setSelectedGrant((prev) =>
        prev
          ? {
              ...prev,
              status: "revoked",
              revokedAt: now,
              revokedBy: "Current Operator",
              revocationReason: "Revoked manually by operator.",
            }
          : null,
      );
    }
  };

  const handleExtendGrant = (grantId: string) => {
    // Revoked grants cannot be extended
    const target = grants.find((g) => g.id === grantId);
    if (!target || target.status === "revoked") return;

    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setGrants((prev) =>
      prev.map((g) =>
        g.id === grantId
          ? {
              ...g,
              expiresAt: newExpiry,
              status: "active",
            }
          : g,
      ),
    );

    if (selectedGrant && selectedGrant.id === grantId) {
      setSelectedGrant((prev) =>
        prev
          ? {
              ...prev,
              expiresAt: newExpiry,
              status: "active",
            }
          : null,
      );
    }
  };

  const filteredGrants = grants.filter((grant) => {
    const isRevoked = grant.status === "revoked" || Boolean(grant.revokedAt);
    if (statusFilter === "active" && isRevoked) return false;
    if (statusFilter === "revoked" && !isRevoked) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = grant.auditorName.toLowerCase().includes(q);
      const matchOrg = grant.auditorOrg.toLowerCase().includes(q);
      const matchId = grant.id.toLowerCase().includes(q);
      return matchName || matchOrg || matchId;
    }

    return true;
  });

  const totalGrants = grants.length;
  const activeGrants = grants.filter((g) => g.status === "active" || g.status === "expiring_soon").length;
  const revokedGrants = grants.filter((g) => g.status === "revoked" || Boolean(g.revokedAt)).length;
  const activeAuditorGrant = selectedGrant ?? grants.find((g) => g.status === "active") ?? grants[0];
  const archivedAuditEvaluation = evaluateAuditorArchivedPeriodAccess({
    role: "auditor",
    grant: activeAuditorGrant,
    runs: MOCK_ARCHIVED_RUNS,
  });

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Audit Grants & Access Scopes
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Surfaces cryptographic auditor permissions, grant lifecycle, and real-time revocation timestamps.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/audit/export"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Audit Packet Export
            </Link>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Grants</span>
              <Key className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mt-2">{totalGrants}</p>
            <p className="text-xs text-gray-400 mt-1">Configured audit view keys</p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Active Grants</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-700 mt-2">{activeGrants}</p>
            <p className="text-xs text-emerald-600 mt-1">Authorized for proof verification</p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-red-600 uppercase tracking-wider">Revoked Grants</span>
              <Ban className="w-4 h-4 text-red-500" />
            </div>
            <p data-testid="revoked-grants-count" className="text-2xl font-extrabold text-red-700 mt-2">
              {revokedGrants}
            </p>
            <p className="text-xs text-red-600 mt-1">Invalidated with immutable timestamps</p>
          </div>
        </div>

        {/* Privacy Assurance Banner */}
        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-900">
          <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <strong>Zero-Knowledge Privacy Standard:</strong> Audit grants only provide off-chain verification keys and aggregated compliance telemetry. Individual salaries, employee personal identifiers, and private commitments are cryptographically protected and never revealed.
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-400 mr-1" />
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All ({grants.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === "active"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Active ({activeGrants})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("revoked")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === "revoked"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Revoked ({revokedGrants})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search auditor, org, or grant ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Grants Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-xs" data-testid="audit-grants-table">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-3">Auditor & Org</th>
                  <th scope="col" className="px-6 py-3">Grant Status</th>
                  <th scope="col" className="px-6 py-3">Revocation / Expiry Info</th>
                  <th scope="col" className="px-6 py-3">Privacy Tier</th>
                  <th scope="col" className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {filteredGrants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No audit grants found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredGrants.map((grant) => {
                    const isRevoked = grant.status === "revoked" || Boolean(grant.revokedAt);

                    return (
                      <tr
                        key={grant.id}
                        data-testid={`grant-row-${grant.id}`}
                        className="hover:bg-gray-50/70 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-sm">{grant.auditorName}</span>
                            <span className="text-gray-500 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-gray-400" />
                              {grant.auditorOrg}
                            </span>
                            <span className="font-mono text-[11px] text-gray-400 mt-1 truncate max-w-xs">
                              {grant.id} &middot; {grant.auditorAddress.slice(0, 10)}...{grant.auditorAddress.slice(-6)}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <AuditGrantRevocationStatus
                            status={grant.status}
                            revokedAt={grant.revokedAt}
                            variant="badge"
                          />
                        </td>

                        <td className="px-6 py-4">
                          {isRevoked ? (
                            <div className="space-y-1">
                              <div
                                data-testid="grant-list-revocation-status"
                                className="flex items-center gap-1.5 text-red-700 font-semibold"
                              >
                                <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                <span>Revoked on:</span>
                              </div>
                              <p
                                data-testid="grant-list-revoked-at"
                                className="text-xs font-mono font-medium text-red-900"
                              >
                                {formatRevocationTimestamp(grant.revokedAt)}
                              </p>
                              {grant.revokedBy && (
                                <p className="text-[11px] text-gray-500">
                                  by <span className="font-medium text-gray-700">{grant.revokedBy}</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1 text-gray-600">
                              <div className="flex items-center gap-1 text-gray-500">
                                <Clock className="w-3 h-3" />
                                <span>Expires: {new Date(grant.expiresAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-[11px] text-gray-400">
                                Issued: {new Date(grant.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Lock className="w-3 h-3 text-indigo-500" />
                            {grant.maskingTier.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenDrawer(grant)}
                            data-testid={`inspect-grant-btn-${grant.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <span>Inspect Scope</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scope Details Drawer */}
        <div
          data-testid="auditor-archived-periods-panel"
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Archived Payroll Periods (Auditor View)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Zero-knowledge redacted view of finalized archived periods accessible under{" "}
                <span className="font-mono font-medium text-gray-700">
                  {activeAuditorGrant?.id ?? "none"}
                </span>
                .
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              {archivedAuditEvaluation.periods.length} Eligible Archived Periods
            </span>
          </div>

          {!archivedAuditEvaluation.allowed ? (
            <div
              data-testid="auditor-archived-access-denied"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{archivedAuditEvaluation.issues[0]?.message}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {archivedAuditEvaluation.periods.map((period) => (
                <div
                  key={period.id}
                  data-testid={`auditor-archived-period-${period.id}`}
                  className="p-3.5 rounded-lg border border-gray-200 bg-gray-50/60 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-gray-900">
                    <span>Period {period.payPeriod}</span>
                    <span className="font-mono text-[11px] text-indigo-700">
                      {period.bundleId ?? "Verified"}
                    </span>
                  </div>
                  <p className="text-gray-600">
                    {period.employerName} &middot; {period.asset} &middot; {period.employeeCount} employees
                  </p>
                  <p className="font-mono text-[11px] text-gray-500">
                    Tx: {period.maskedTransactionHash} &middot; Salary: {period.compensationDisplay}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <AuditGrantScopeDetailsDrawer
          isOpen={isDrawerOpen}
          grant={selectedGrant ?? undefined}
          onClose={handleCloseDrawer}
          onRevokeGrant={handleRevokeGrant}
          onExtendGrant={handleExtendGrant}
        />
      </div>
    </DashboardLayout>
  );
}
