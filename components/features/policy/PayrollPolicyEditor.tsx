"use client";

import React, { useMemo } from "react";
import {
  Save,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Landmark,
  ShieldCheck,
  Gauge,
  Archive,
  Layers,
} from "lucide-react";
import { usePayrollPolicyStore, type PolicySectionTab } from "@/stores/payrollPolicy";
import { TimingPolicySection } from "./TimingPolicySection";
import { ReservesPolicySection } from "./ReservesPolicySection";
import { ApprovalsPolicySection } from "./ApprovalsPolicySection";
import { CapacityPolicySection } from "./CapacityPolicySection";
import { AuditRetentionPolicySection } from "./AuditRetentionPolicySection";
import { ValidationPreviewPanel } from "./ValidationPreviewPanel";

export function PayrollPolicyEditor() {
  const {
    policy,
    savedPolicy,
    compilationResult,
    isSaving,
    saveSuccess,
    saveError,
    activeTab,
    updateTiming,
    updateReserves,
    updateApprovals,
    updateCapacity,
    updateAuditRetention,
    setActiveTab,
    savePolicy,
    resetToSaved,
    resetToDefaults,
  } = usePayrollPolicyStore();

  const isDirty = useMemo(() => {
    return (
      JSON.stringify(policy.timing) !== JSON.stringify(savedPolicy.timing) ||
      JSON.stringify(policy.reserves) !== JSON.stringify(savedPolicy.reserves) ||
      JSON.stringify(policy.approvals) !== JSON.stringify(savedPolicy.approvals) ||
      JSON.stringify(policy.capacity) !== JSON.stringify(savedPolicy.capacity) ||
      JSON.stringify(policy.auditRetention) !== JSON.stringify(savedPolicy.auditRetention)
    );
  }, [policy, savedPolicy]);

  const timingIssues = useMemo(
    () => compilationResult.issues.filter((i) => i.section === "timing"),
    [compilationResult.issues]
  );
  const reservesIssues = useMemo(
    () => compilationResult.issues.filter((i) => i.section === "reserves"),
    [compilationResult.issues]
  );
  const approvalsIssues = useMemo(
    () => compilationResult.issues.filter((i) => i.section === "approvals"),
    [compilationResult.issues]
  );
  const capacityIssues = useMemo(
    () => compilationResult.issues.filter((i) => i.section === "capacity"),
    [compilationResult.issues]
  );
  const auditIssues = useMemo(
    () => compilationResult.issues.filter((i) => i.section === "auditRetention"),
    [compilationResult.issues]
  );

  const getSectionIssueBadge = (issues: typeof timingIssues) => {
    const errCount = issues.filter((i) => i.severity === "error").length;
    const warnCount = issues.filter((i) => i.severity === "warning").length;
    if (errCount > 0) {
      return (
        <span className="ml-1.5 px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">
          {errCount}
        </span>
      );
    }
    if (warnCount > 0) {
      return (
        <span className="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
          {warnCount}
        </span>
      );
    }
    return null;
  };

  const tabs: Array<{ id: PolicySectionTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: React.ReactNode }> = [
    { id: "all", label: "All Sections", icon: Layers },
    { id: "timing", label: "Timing & Settlement", icon: Clock, badge: getSectionIssueBadge(timingIssues) },
    { id: "reserves", label: "Treasury Reserves", icon: Landmark, badge: getSectionIssueBadge(reservesIssues) },
    { id: "approvals", label: "Approvals & Governance", icon: ShieldCheck, badge: getSectionIssueBadge(approvalsIssues) },
    { id: "capacity", label: "Capacity Limits", icon: Gauge, badge: getSectionIssueBadge(capacityIssues) },
    { id: "auditRetention", label: "Audit & Retention", icon: Archive, badge: getSectionIssueBadge(auditIssues) },
  ];

  const handleSave = async () => {
    await savePolicy("Admin");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header Card */}
      <header className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Payroll Policy Editor</h1>
              <span
                data-testid="policy-version-badge"
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
              >
                v{savedPolicy.version}.0
              </span>
              {isDirty ? (
                <span
                  data-testid="policy-status-dirty"
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                >
                  Unsaved Changes
                </span>
              ) : (
                <span
                  data-testid="policy-status-synced"
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200"
                >
                  Active & Synced
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Configure settlement windows, reserve rules, approval requirements, capacity limits, and audit retention settings.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Last saved by {savedPolicy.updatedBy} on {new Date(savedPolicy.updatedAt).toLocaleDateString()} at{" "}
              {new Date(savedPolicy.updatedAt).toLocaleTimeString()}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={resetToSaved}
              disabled={!isDirty || isSaving}
              data-testid="reset-to-saved-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset to Saved
            </button>

            <button
              type="button"
              onClick={resetToDefaults}
              disabled={isSaving}
              data-testid="reset-to-defaults-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset to Defaults
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!compilationResult.isValid || isSaving}
              data-testid="save-policy-btn"
              title={
                !compilationResult.isValid
                  ? "Cannot save policy: resolve critical validation errors first"
                  : "Save and compile policy to on-chain registry"
              }
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              {isSaving ? "Compiling & Saving..." : "Save Policy"}
            </button>
          </div>
        </div>

        {/* Save feedback alerts */}
        {saveSuccess && (
          <div
            role="status"
            aria-live="polite"
            data-testid="save-success-banner"
            className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200 flex items-center gap-3 text-green-900 text-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Payroll policy saved and compiled successfully!</p>
              <p className="text-xs text-green-700 mt-0.5">
                New policy version v{savedPolicy.version}.0 is active and anchored with digest{" "}
                <code className="font-mono">{compilationResult.compiledDigest}</code>.
              </p>
            </div>
          </div>
        )}

        {saveError && (
          <div
            role="alert"
            data-testid="save-error-banner"
            className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3 text-red-900 text-sm"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Unable to save payroll policy</p>
              <p className="text-xs text-red-700 mt-0.5">{saveError}</p>
            </div>
          </div>
        )}

        {!compilationResult.isValid && !saveError && (
          <div
            role="alert"
            data-testid="save-blocked-alert"
            className="mt-4 p-3.5 rounded-lg bg-red-50/70 border border-red-200 flex items-center gap-2.5 text-xs text-red-900"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <span>
              <strong>Saving is blocked:</strong> Policy contains {compilationResult.summary.errorsCount} critical
              error{compilationResult.summary.errorsCount !== 1 ? "s" : ""}. Review the compiler preview to resolve
              blockers before saving.
            </span>
          </div>
        )}
      </header>

      {/* Section Navigation Tabs */}
      <nav aria-label="Policy sections" className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? "page" : undefined}
              data-testid={`tab-${tab.id}`}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-500"}`} aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </nav>

      {/* Main 2-Column Grid: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <main className="lg:col-span-7 space-y-6">
          {(activeTab === "all" || activeTab === "timing") && (
            <TimingPolicySection
              timing={policy.timing}
              onChange={updateTiming}
              issues={timingIssues}
            />
          )}

          {(activeTab === "all" || activeTab === "reserves") && (
            <ReservesPolicySection
              reserves={policy.reserves}
              onChange={updateReserves}
              issues={reservesIssues}
            />
          )}

          {(activeTab === "all" || activeTab === "approvals") && (
            <ApprovalsPolicySection
              approvals={policy.approvals}
              onChange={updateApprovals}
              issues={approvalsIssues}
            />
          )}

          {(activeTab === "all" || activeTab === "capacity") && (
            <CapacityPolicySection
              capacity={policy.capacity}
              onChange={updateCapacity}
              issues={capacityIssues}
            />
          )}

          {(activeTab === "all" || activeTab === "auditRetention") && (
            <AuditRetentionPolicySection
              auditRetention={policy.auditRetention}
              onChange={updateAuditRetention}
              issues={auditIssues}
            />
          )}
        </main>

        <div className="lg:col-span-5">
          <ValidationPreviewPanel compilationResult={compilationResult} />
        </div>
      </div>
    </div>
  );
}

export default PayrollPolicyEditor;
