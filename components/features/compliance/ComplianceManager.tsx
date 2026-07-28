"use client";

import { useState, useMemo } from "react";
import {
  Key,
  Plus,
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  Eye,
  EyeOff,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { useViewKeyStore } from "@/stores/viewKeys";
import { useAuditRequestStore } from "@/stores/auditRequests";
import { MOCK_VIEW_KEYS, MOCK_AUDIT_REQUESTS } from "@/lib/api/mockData";
import { HelpButton } from "@/components/ui/HelpDrawer";
import AuditActivityFeed from "./AuditActivityFeed";
import type { ViewKey } from "@/types";
import AuditExportRequest from "./AuditExportRequest";
import type { AuditAccessRequest } from "@/types/models";

function generateKeyId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "vk_";
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function ComplianceManager() {
  const { viewKeys, addViewKey, revokeViewKey, setViewKeys } =
    useViewKeyStore();
  const [activeTab, setActiveTab] = useState<"access" | "exports">("access");
  const { requests, setRequests, approveRequest, rejectRequest } =
    useAuditRequestStore();
  const [initialized, setInitialized] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    auditorName: "",
    auditorOrg: "",
    scope: "read-only" as "read-only" | "full-audit",
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!initialized && (viewKeys.length === 0 || requests.length === 0)) {
    if (viewKeys.length === 0) setViewKeys(MOCK_VIEW_KEYS);
    if (requests.length === 0) setRequests(MOCK_AUDIT_REQUESTS);
    setInitialized(true);
  }

  const handleApproveRequest = (request: AuditAccessRequest) => {
    const keyId = generateKeyId();
    const newKey: ViewKey = {
      id: `vk_${Date.now()}`,
      keyId,
      auditorName: request.requesterName,
      auditorOrg: request.requesterOrg,
      scope: request.scope,
      grantedBy: "Current Admin",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    };
    addViewKey(newKey);
    approveRequest(request.id, newKey.id);
    toast.success("Request Approved", {
      description: `View key generated for ${request.requesterName}.`,
    });
  };

  const handleRejectRequest = (id: string) => {
    rejectRequest(id);
    toast.success("Request Rejected", {
      description: "The audit access request has been rejected.",
    });
  };

  const handleGenerate = () => {
    const newKey: ViewKey = {
      id: `vk_${Date.now()}`,
      keyId: generateKeyId(),
      auditorName: form.auditorName,
      auditorOrg: form.auditorOrg,
      scope: form.scope,
      grantedBy: "Current Admin",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    };
    addViewKey(newKey);
    setForm({ auditorName: "", auditorOrg: "", scope: "read-only" });
    setShowForm(false);
    toast.success("View key generated", {
      description: "Auditor access has been granted.",
    });
  };

  const handleRevoke = (id: string) => {
    revokeViewKey(id);
    toast.success("View key revoked", {
      description: "Auditor access has been immediately revoked.",
    });
  };

  const toggleReveal = (id: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyKeyId = async (keyId: string, id: string) => {
    await navigator.clipboard.writeText(keyId);
    setCopiedId(id);
    toast.success("Copied to clipboard", {
      description: "Key ID copied to clipboard.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeKeys = viewKeys.filter((k) => k.isActive);
  const inactiveKeys = viewKeys.filter((k) => !k.isActive);
  const pendingRequests = requests.filter((r) => r.status === "pending");

  // ── Auditor Access Expiration Detection ──────────────────────────
  // Checks active view keys for upcoming or already-expired access.
  const EXPIRATION_WARNING_DAYS = 30; // warn when key expires within 30 days

  const { expiringKeys, expiredKeys } = useMemo(() => {
    const now = Date.now();
    const expiring: ViewKey[] = [];
    const expired: ViewKey[] = [];

    for (const key of viewKeys) {
      const expiresAt = new Date(key.expiresAt).getTime();
      const daysUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

      if (key.isActive && daysUntilExpiry <= 0) {
        // Active key that has already passed its expiry date — treat as expired
        expired.push(key);
      } else if (key.isActive && daysUntilExpiry <= EXPIRATION_WARNING_DAYS) {
        expiring.push(key);
      }
    }

    return { expiringKeys: expiring, expiredKeys: expired };
  }, [viewKeys]);

  return (
    <section aria-labelledby="compliance-heading" className="space-y-6">
      {/* ── Auditor Access Expiration Banner ────────────────────────── */}
      {expiredKeys.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-300"
        >
          <Timer className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              Auditor Access Expired
            </p>
            <p className="text-xs text-red-700 mt-1">
              {expiredKeys.length} active view key{expiredKeys.length > 1 ? "s have" : " has"} passed their expiration date.
              {expiredKeys.length > 1 ? " These keys" : " This key"} may no longer function correctly.
              Please revoke and reissue {expiredKeys.length > 1 ? "them" : "it"} to restore access.
            </p>
            <ul className="mt-2 space-y-1">
              {expiredKeys.map((key) => (
                <li key={key.id} className="text-xs text-red-700 flex items-center gap-2">
                  <span className="font-medium">{key.auditorName}</span>
                  <span className="text-red-500">
                    (expired {new Date(key.expiresAt).toLocaleDateString()})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {expiringKeys.length > 0 && expiredKeys.length === 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-300"
        >
          <Timer className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              Auditor Access Expiring Soon
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {expiringKeys.length} active view key{expiringKeys.length > 1 ? "s are" : " is"} expiring within {EXPIRATION_WARNING_DAYS} days.
              Consider renewing {expiringKeys.length > 1 ? "them" : "it"} to avoid interruption.
            </p>
            <ul className="mt-2 space-y-1">
              {expiringKeys.map((key) => {
                const daysLeft = Math.floor(
                  (new Date(key.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <li key={key.id} className="text-xs text-amber-700 flex items-center gap-2">
                    <span className="font-medium">{key.auditorName}</span>
                    <span className="text-amber-600">
                      ({daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining — expires {new Date(key.expiresAt).toLocaleDateString()})
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2
            id="compliance-heading"
            className="text-lg font-semibold text-gray-900"
          >
            Auditor Access Management
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage and monitor compliance-related activities. Selective disclosure
            and scope-limited exports ensure data privacy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton page="compliance" label="Help" />
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("access")}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === "access"
              ? "text-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Access Management
          {activeTab === "access" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-in fade-in slide-in-from-bottom-1" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("exports")}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === "exports"
              ? "text-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Audit Exports
          {activeTab === "exports" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 animate-in fade-in slide-in-from-bottom-1" />
          )}
        </button>
      </div>

      {activeTab === "access" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Auditor View Keys
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Generate Key
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-amber-800">
                  Privacy Notice
                </h4>
                <p className="text-xs text-amber-700 mt-1">
                  View keys allow auditors to decrypt specific payroll data without
                  exposing full employee records. Read-only keys permit viewing
                  transaction summaries. Full-audit keys additionally reveal
                  departmental breakdowns. Revoking a key immediately invalidates
                  access.
                </p>
              </div>
            </div>
          </div>

          {showForm && (
            <div
              role="form"
              aria-label="Generate new view key"
              className="bg-white rounded-lg border p-6 space-y-4 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-gray-900">
                New Auditor View Key
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="auditor-name"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Auditor Name
                  </label>
                  <input
                    id="auditor-name"
                    type="text"
                    value={form.auditorName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, auditorName: e.target.value }))
                    }
                    placeholder="e.g. Sarah Chen"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="auditor-org"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Organization
                  </label>
                  <input
                    id="auditor-org"
                    type="text"
                    value={form.auditorOrg}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, auditorOrg: e.target.value }))
                    }
                    placeholder="e.g. Deloitte"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="auditor-scope"
                    className="block text-xs font-medium text-gray-600 mb-1"
                  >
                    Access Scope
                  </label>
                  <select
                    id="auditor-scope"
                    value={form.scope}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        scope: e.target.value as "read-only" | "full-audit",
                      }))
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="read-only">Read-only</option>
                    <option value="full-audit">Full Audit</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!form.auditorName || !form.auditorOrg}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  Generate
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {pendingRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Pending Requests ({pendingRequests.length})
              </h3>
              <div className="bg-white rounded-lg border divide-y">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">{req.requesterName}</span>
                        <span className="text-sm text-gray-500">({req.requesterOrg})</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                            req.scope === "full-audit"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {req.scope === "full-audit" ? "Full Audit" : "Read-only"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{req.rationale}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">
                          Requested {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {req.requesterEmail}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(req)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(req.id)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeKeys.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                Active Keys ({activeKeys.length})
              </h4>
              <div className="bg-white rounded-lg border divide-y">
                {activeKeys.map((key) => (
                  <ViewKeyRow
                    key={key.id}
                    viewKey={key}
                    isRevealed={revealedKeys.has(key.id)}
                    isCopied={copiedId === key.id}
                    onToggleReveal={() => toggleReveal(key.id)}
                    onCopy={() => copyKeyId(key.keyId, key.id)}
                    onRevoke={() => handleRevoke(key.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {inactiveKeys.length > 0 && (
            <div className="pt-6">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5 text-gray-400" />
                Revoked Keys ({inactiveKeys.length})
              </h4>
              <div className="bg-white rounded-lg border divide-y opacity-75">
                {inactiveKeys.map((key) => (
                  <ViewKeyRow
                    key={key.id}
                    viewKey={key}
                    isRevealed={revealedKeys.has(key.id)}
                    isCopied={copiedId === key.id}
                    onToggleReveal={() => toggleReveal(key.id)}
                    onCopy={() => copyKeyId(key.keyId, key.id)}
                    onRevoke={() => {}}
                  />
                ))}
              </div>
            </div>
          )}

          <AuditActivityFeed />
        </div>
      ) : (
        <AuditExportRequest />
      )}
    </section>
  );
}

function ViewKeyRow({
  viewKey,
  isRevealed,
  isCopied,
  onToggleReveal,
  onCopy,
  onRevoke,
}: {
  viewKey: ViewKey;
  isRevealed: boolean;
  isCopied: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  const isExpired =
    !viewKey.isActive && !viewKey.revokedAt;
  const displayKey = isRevealed
    ? viewKey.keyId
    : viewKey.keyId.slice(0, 6) + "****";

  return (
    <div className="px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-mono text-sm text-gray-900">{displayKey}</span>
          <button
            type="button"
            onClick={onToggleReveal}
            className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={isRevealed ? "Hide key" : "Reveal key"}
          >
            {isRevealed ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Copy key ID"
          >
            <Copy className="w-3.5 h-3.5" />
            {isCopied && (
              <span className="text-xs text-green-600 ml-1">Copied</span>
            )}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {viewKey.auditorName} &middot; {viewKey.auditorOrg}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
              viewKey.isActive
                ? viewKey.scope === "full-audit"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {viewKey.scope === "full-audit" ? "Full Audit" : "Read-only"}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Expires {new Date(viewKey.expiresAt).toLocaleDateString()}
          </span>
          {viewKey.revokedAt && (
            <span className="text-xs text-red-500">
              Revoked {new Date(viewKey.revokedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      {viewKey.isActive && (
        <button
          type="button"
          onClick={onRevoke}
          className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1"
        >
          <AlertTriangle className="w-3 h-3" />
          Revoke
        </button>
      )}
    </div>
  );
}

export default ComplianceManager;
