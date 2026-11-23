"use client";

import React from "react";
import type { BlockedExecutionReport } from "@/lib/sdk/blockedExecutionDiagnostics";

export interface BlockedExecutionDiagnosticsPanelProps {
  report: BlockedExecutionReport;
  className?: string;
}

function validateReport(report: BlockedExecutionReport): string | null {
  if (!report || typeof report !== "object") return "A diagnostics report is required.";
  if (typeof report.canExecute !== "boolean" || typeof report.isBlocked !== "boolean")
    return "Report has invalid execution flags.";
  if (!Array.isArray(report.blockers) || !Array.isArray(report.warnings))
    return "Report blockers and warnings must be arrays.";
  return null;
}

export function BlockedExecutionDiagnosticsPanel({
  report,
  className = "",
}: BlockedExecutionDiagnosticsPanelProps) {
  const error = validateReport(report);

  if (error) {
    return (
      <div role="alert" data-testid="blocked-execution-error" className={className}>
        Diagnostics unavailable: {error}
      </div>
    );
  }

  const statusLabel = report.isBlocked ? "Blocked" : "Ready";
  return (
    <section
      aria-label="Blocked execution diagnostics"
      data-testid="blocked-execution-diagnostics"
      data-status={statusLabel}
      className={className}
    >
      <header>
        <h2>Execution Diagnostics</h2>
        <p data-testid="blocked-execution-summary">{report.summary}</p>
        <p data-testid="blocked-execution-status">
          {report.isBlocked ? "Execution blocked" : "Execution clear"} —{" "}
          {report.blockerCount} blocker(s), {report.warningCount} warning(s)
        </p>
      </header>

      {report.primaryBlocker && (
        <div data-testid="blocked-execution-primary">
          <strong>{report.primaryBlocker.code}</strong>: {report.primaryBlocker.title}
          <p>{report.primaryBlocker.message}</p>
          <p>
            Next step: {report.primaryBlocker.remediation.label}
            {report.primaryBlocker.remediation.href
              ? ` (${report.primaryBlocker.remediation.href})`
              : ""}
          </p>
        </div>
      )}

      {report.blockers.length > 0 && (
        <ul data-testid="blocked-execution-blockers">
          {report.blockers.map((b) => (
            <li key={b.code} data-testid={`blocker-${b.code}`}>
              [{b.category}] {b.code}: {b.title} — {b.remediation.label}
            </li>
          ))}
        </ul>
      )}

      {report.warnings.length > 0 && (
        <ul data-testid="blocked-execution-warnings">
          {report.warnings.map((w) => (
            <li key={w.code} data-testid={`warning-${w.code}`}>
              [{w.category}] {w.code}: {w.title}
            </li>
          ))}
        </ul>
      )}

      <p data-testid="blocked-execution-privacy">
        Privacy-safe: aggregates only, no individual salaries or secrets.
      </p>
    </section>
  );
}

export default BlockedExecutionDiagnosticsPanel;
