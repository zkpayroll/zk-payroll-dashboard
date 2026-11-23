"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  RefreshCw,
  Download,
  ArrowRight,
  Coins,
  Lock,
  Wallet,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
} from "lucide-react";

export interface PreflightCheckItem {
  id: string;
  title: string;
  category: "treasury" | "proof" | "wallet" | "contract" | "permission";
  severity: "blocker" | "warning" | "pass";
  description: string;
  fixActionLabel?: string;
  onFixAction?: () => void;
  fixed?: boolean;
}

export interface PayrollPreflightResultsScreenProps {
  payrollRunId?: string;
  companyId?: string;
  totalAmount?: number;
  employeeCount?: number;
  treasuryBalance?: number;
  proofReady?: boolean;
  contractState?: "active" | "paused" | "locked";
  checks?: PreflightCheckItem[];
  onRerunPreflight?: () => void;
  onExecutePayroll?: () => void;
  onExportReport?: () => void;
  isLoading?: boolean;
  className?: string;
}

const DEFAULT_CHECKS: PreflightCheckItem[] = [
  {
    id: "check-treasury-balance",
    title: "Treasury Balance & Solvency Check",
    category: "treasury",
    severity: "pass",
    description: "Sufficient liquid treasury reserves available to cover total batch payout.",
  },
  {
    id: "check-zk-proof",
    title: "Zero-Knowledge Circuit Proof Verification",
    category: "proof",
    severity: "pass",
    description: "ZK-SNARK proof validity confirmed by preflight verifier node.",
  },
  {
    id: "check-recipient-addresses",
    title: "Employee Recipient Wallet Address Audit",
    category: "wallet",
    severity: "pass",
    description: "All batch recipient addresses are verified and active on network.",
  },
  {
    id: "check-contract-state",
    title: "Smart Contract Execution State",
    category: "contract",
    severity: "pass",
    description: "Payroll smart contract is active and accepts batch executions.",
  },
  {
    id: "check-operator-permission",
    title: "Operator Signing Authorization",
    category: "permission",
    severity: "pass",
    description: "Connected wallet possesses valid operator signing role.",
  },
];

export function PayrollPreflightResultsScreen({
  payrollRunId = "run-preflight-demo",
  companyId = "comp-001",
  totalAmount = 45000,
  employeeCount = 12,
  treasuryBalance = 150000,
  proofReady = true,
  contractState = "active",
  checks = DEFAULT_CHECKS,
  onRerunPreflight,
  onExecutePayroll,
  onExportReport,
  isLoading = false,
  className = "",
}: PayrollPreflightResultsScreenProps) {
  const [showPassedChecks, setShowPassedChecks] = useState(true);

  const blockers = checks.filter((c) => c.severity === "blocker" && !c.fixed);
  const warnings = checks.filter((c) => c.severity === "warning");
  const passed = checks.filter((c) => c.severity === "pass" || c.fixed);

  const totalChecks = checks.length;
  const passedCount = passed.length;
  const readinessScore = totalChecks > 0 ? Math.round((passedCount / totalChecks) * 100) : 0;
  const isReady = blockers.length === 0;

  const handleExport = () => {
    if (onExportReport) {
      onExportReport();
      return;
    }

    const reportData = {
      payrollRunId,
      companyId,
      timestamp: new Date().toISOString(),
      readinessScore,
      isReady,
      blockersCount: blockers.length,
      warningsCount: warnings.length,
      passedCount: passed.length,
      metrics: {
        totalAmount,
        employeeCount,
        treasuryBalance,
        proofReady,
        contractState,
      },
      checks,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preflight-report-${payrollRunId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid="payroll-preflight-results-screen"
      className={`space-y-6 max-w-6xl mx-auto p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}
    >
      {/* Header Banner */}
      <div
        data-testid="preflight-header-banner"
        className={`p-6 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
          isReady
            ? "bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-emerald-200"
            : "bg-gradient-to-r from-amber-50 via-red-50 to-white border-amber-300"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-full shrink-0 ${
              isReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {isReady ? <CheckCircle2 className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Payroll Preflight Execution Screen</h1>
              <span
                data-testid="readiness-status-badge"
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isReady ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"
                }`}
              >
                {isReady ? "READY FOR EXECUTION" : "BLOCKED — FIX REQUIRED"}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Dry-run preflight validation checks treasury solvency, ZK circuit proof, recipient addresses, and contract parameters before submitting transactions.
            </p>
          </div>
        </div>

        {/* Score Ring / Badge */}
        <div className="flex items-center gap-4 bg-white/80 backdrop-blur border rounded-lg px-4 py-3 shrink-0 self-start md:self-auto shadow-xs">
          <div className="text-right">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Readiness Score</p>
            <p
              data-testid="readiness-score-value"
              className={`text-2xl font-extrabold ${isReady ? "text-emerald-600" : "text-amber-600"}`}
            >
              {readinessScore}%
            </p>
          </div>
          <div className="text-xs text-gray-500 border-l pl-3 space-y-0.5">
            <p className="font-semibold text-gray-800">{passedCount} / {totalChecks} Passed</p>
            <p className="text-red-600 font-medium">{blockers.length} Blockers</p>
            <p className="text-amber-600 font-medium">{warnings.length} Warnings</p>
          </div>
        </div>
      </div>

      {/* Dry Run Preflight Metrics Summary Card */}
      <div
        data-testid="preflight-summary-card"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200"
      >
        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Coins className="w-3.5 h-3.5 text-indigo-500" />
            <span>Total Payout Amount</span>
          </div>
          <p className="text-base font-bold text-gray-900">${totalAmount.toLocaleString()}</p>
        </div>

        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Wallet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Available Treasury</span>
          </div>
          <p className="text-base font-bold text-gray-900">${treasuryBalance.toLocaleString()}</p>
        </div>

        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <FileCheck className="w-3.5 h-3.5 text-blue-500" />
            <span>Recipients Count</span>
          </div>
          <p className="text-base font-bold text-gray-900">{employeeCount} Employees</p>
        </div>

        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Zap className="w-3.5 h-3.5 text-purple-500" />
            <span>ZK Proof Circuit</span>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
              proofReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {proofReady ? "Proof Valid & Ready" : "Pending Generation"}
          </span>
        </div>

        <div className="p-3 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Lock className="w-3.5 h-3.5 text-gray-500" />
            <span>Contract State</span>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${
              contractState === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            }`}
          >
            {contractState}
          </span>
        </div>
      </div>

      {/* Blockers Section */}
      {blockers.length > 0 && (
        <section data-testid="preflight-blockers-section" className="space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-red-900">
              Critical Blockers ({blockers.length})
            </h2>
            <span className="text-xs text-red-600 font-medium">
              Must be resolved before payroll execution is permitted
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {blockers.map((blocker) => (
              <div
                key={blocker.id}
                data-testid="preflight-blocker-card"
                className="p-4 rounded-xl border border-red-200 bg-red-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-red-200 text-red-900">
                      {blocker.category}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900">{blocker.title}</h3>
                  </div>
                  <p className="text-xs text-red-800">{blocker.description}</p>
                </div>

                {blocker.fixActionLabel && (
                  <button
                    type="button"
                    onClick={blocker.onFixAction}
                    data-testid={`fix-btn-${blocker.id}`}
                    className="shrink-0 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span>{blocker.fixActionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Warnings Section */}
      {warnings.length > 0 && (
        <section data-testid="preflight-warnings-section" className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900">
              Preflight Warnings ({warnings.length})
            </h2>
            <span className="text-xs text-amber-700">
              Non-blocking operational notices for review
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {warnings.map((warning) => (
              <div
                key={warning.id}
                data-testid="preflight-warning-card"
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-200 text-amber-900">
                      {warning.category}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900">{warning.title}</h3>
                  </div>
                  <p className="text-xs text-amber-800">{warning.description}</p>
                </div>

                {warning.fixActionLabel && (
                  <button
                    type="button"
                    onClick={warning.onFixAction}
                    data-testid={`fix-btn-${warning.id}`}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"
                  >
                    {warning.fixActionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Passed Checks Collapsible Section */}
      <section data-testid="preflight-passed-section" className="space-y-3 pt-2">
        <button
          type="button"
          onClick={() => setShowPassedChecks((prev) => !prev)}
          className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-semibold transition-colors"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Passed Preflight Checks ({passed.length})</span>
          </div>
          {showPassedChecks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showPassedChecks && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {passed.map((item) => (
              <div
                key={item.id}
                data-testid="preflight-passed-card"
                className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/30 flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-[11px] text-gray-600 mt-0.5">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Action Footer Toolbar */}
      <div
        data-testid="preflight-action-toolbar"
        className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onRerunPreflight}
            disabled={isLoading}
            data-testid="rerun-preflight-btn"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Re-run Dry Run</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            data-testid="export-preflight-btn"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onExecutePayroll}
            disabled={!isReady || isLoading}
            data-testid="execute-payroll-btn"
            title={!isReady ? "Resolve all blockers before proceeding to execution" : "Proceed to execution"}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <span>Proceed to Execution</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PayrollPreflightResultsScreen;
