"use client";

import React from "react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Shield,
  Cpu,
  Hash,
  Activity,
} from "lucide-react";
import type { CompiledPolicyResult } from "@/types/policy";

interface ValidationPreviewPanelProps {
  compilationResult: CompiledPolicyResult;
}

export function ValidationPreviewPanel({ compilationResult }: ValidationPreviewPanelProps) {
  const { isValid, hasWarnings, summary, issues, impactPreview, compiledDigest } =
    compilationResult;

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  const riskBadgeStyles = {
    low: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-blue-100 text-blue-800 border-blue-200",
    high: "bg-amber-100 text-amber-800 border-amber-200",
    critical: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <aside
      aria-labelledby="validation-preview-heading"
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6 lg:sticky lg:top-6"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-600" aria-hidden="true" />
          <h2 id="validation-preview-heading" className="text-base font-semibold text-gray-900">
            SDK Policy Compiler Preview
          </h2>
        </div>
        <span
          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border uppercase tracking-wider ${
            riskBadgeStyles[impactPreview.riskRating]
          }`}
          data-testid="policy-risk-rating"
        >
          {impactPreview.riskRating} Risk
        </span>
      </div>

      {/* Compiler Verdict Status Banner */}
      <div
        role="status"
        aria-live="polite"
        data-testid="compiler-verdict-banner"
        className={`p-4 rounded-xl border flex items-start gap-3 ${
          !isValid
            ? "bg-red-50 border-red-200 text-red-900"
            : hasWarnings
            ? "bg-amber-50 border-amber-200 text-amber-900"
            : "bg-green-50 border-green-200 text-green-900"
        }`}
      >
        {!isValid ? (
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        ) : hasWarnings ? (
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">
            {!isValid
              ? `Compilation Failed (${summary.errorsCount} Blocker${summary.errorsCount !== 1 ? "s" : ""})`
              : hasWarnings
              ? `Compilation Passed with Warnings (${summary.warningsCount} Notice${summary.warningsCount !== 1 ? "s" : ""})`
              : "Compilation Passed: Ready for Deployment"}
          </p>
          <p className="text-xs mt-0.5 opacity-90">
            {!isValid
              ? "Critical validation errors prevent this policy from being saved or applied to smart contracts."
              : hasWarnings
              ? "All critical invariants met. Review security advisories below prior to committing."
              : "All smart contract invariants and cryptographic guardrails verified successfully."}
          </p>
        </div>
      </div>

      {/* Compiler Metrics & Digest */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
          <span className="text-[11px] text-gray-500 font-medium block">Rules Evaluated</span>
          <span className="text-sm font-bold text-gray-900" data-testid="compiler-checks-metric">
            {summary.passedChecks} / {summary.totalChecks} Passed
          </span>
        </div>

        <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
          <span className="text-[11px] text-gray-500 font-medium block flex items-center gap-1">
            <Hash className="w-3 h-3 text-gray-400" aria-hidden="true" />
            Bytecode Digest
          </span>
          <span
            className="text-xs font-mono font-semibold text-indigo-700 truncate block mt-0.5"
            title={compiledDigest}
            data-testid="compiled-digest"
          >
            {compiledDigest}
          </span>
        </div>
      </div>

      {/* Errors Section (Blockers) */}
      {errors.length > 0 && (
        <div className="space-y-3" data-testid="validation-errors-list">
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            Critical Errors ({errors.length}) — Saving Blocked
          </h3>
          <ul className="space-y-2">
            {errors.map((err) => (
              <li
                key={err.id}
                data-testid={`error-item-${err.id}`}
                className="p-3 rounded-lg bg-red-50/80 border border-red-200 text-xs text-red-900"
              >
                <p className="font-semibold text-red-950">{err.title}</p>
                <p className="mt-0.5 text-red-800">{err.message}</p>
                {err.remediation && (
                  <p className="mt-1 text-[11px] text-red-700 font-medium">
                    Fix: {err.remediation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings Section */}
      {warnings.length > 0 && (
        <div className="space-y-3" data-testid="validation-warnings-list">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            Security & Operational Warnings ({warnings.length})
          </h3>
          <ul className="space-y-2">
            {warnings.map((warn) => (
              <li
                key={warn.id}
                data-testid={`warning-item-${warn.id}`}
                className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900"
              >
                <p className="font-semibold text-amber-950">{warn.title}</p>
                <p className="mt-0.5 text-amber-800">{warn.message}</p>
                {warn.remediation && (
                  <p className="mt-1 text-[11px] text-amber-700 font-medium">
                    Recommendation: {warn.remediation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Live Policy Impact Summary */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-indigo-500" aria-hidden="true" />
          Runtime Policy Impact Analysis
        </h3>
        <div className="space-y-2.5 text-xs text-gray-600 bg-gray-50 rounded-lg p-3.5 border border-gray-100">
          <div>
            <span className="font-semibold text-gray-900 block">Settlement Schedule:</span>
            <p className="text-[11px] mt-0.5 text-gray-600">
              {impactPreview.settlementWindowSummary}
            </p>
          </div>
          <div>
            <span className="font-semibold text-gray-900 block">Reserve Liquidity:</span>
            <p className="text-[11px] mt-0.5 text-gray-600">
              {impactPreview.reserveProtectionSummary}
            </p>
          </div>
          <div>
            <span className="font-semibold text-gray-900 block">Governance Quorum:</span>
            <p className="text-[11px] mt-0.5 text-gray-600">
              {impactPreview.governanceSummary}
            </p>
          </div>
          <div>
            <span className="font-semibold text-gray-900 block">Throughput Ceilings:</span>
            <p className="text-[11px] mt-0.5 text-gray-600">
              {impactPreview.capacitySummary}
            </p>
          </div>
          <div>
            <span className="font-semibold text-gray-900 block">Compliance Audit:</span>
            <p className="text-[11px] mt-0.5 text-gray-600">
              {impactPreview.auditComplianceSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Info Signals */}
      {infos.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
            <Info className="w-4 h-4" aria-hidden="true" />
            Enforced Signals ({infos.length})
          </h3>
          <ul className="space-y-1.5">
            {infos.map((inf) => (
              <li
                key={inf.id}
                className="text-xs text-gray-600 flex items-start gap-2 bg-blue-50/50 p-2 rounded border border-blue-100"
              >
                <Shield className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{inf.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
