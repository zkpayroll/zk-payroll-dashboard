"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  PlayCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import {
  fetchPayrollSimulation,
  type PayrollSimulationResult,
  type SimulationSeverity,
} from "@/lib/sdk/payrollSimulation";

type LoadState = "loading" | "loaded" | "error" | "empty";

const SEVERITY_CONFIG: Record<
  SimulationSeverity,
  { label: string; icon: LucideIcon; badgeClass: string; rowClass: string }
> = {
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    badgeClass: "bg-green-50 text-green-700 border-green-200",
    rowClass: "border-green-100",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    rowClass: "border-amber-100",
  },
  blocked: {
    label: "Blocked",
    icon: XCircle,
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    rowClass: "border-red-200",
  },
};

const SECTIONS: Array<{ severity: SimulationSeverity; heading: string }> = [
  { severity: "blocked", heading: "Blocked — must be resolved before execution" },
  { severity: "warning", heading: "Warnings — review before executing" },
  { severity: "ready", heading: "Ready — no action needed" },
];

function CheckRow({ check }: { check: PayrollSimulationResult["checks"][number] }) {
  const config = SEVERITY_CONFIG[check.severity];
  const Icon = config.icon;
  return (
    <li
      data-testid="simulation-check"
      className={`flex items-start gap-3 border rounded-lg p-4 bg-white ${config.rowClass}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${config.badgeClass}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{check.title}</p>
          <span
            role="status"
            aria-label={`Severity: ${config.label}`}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${config.badgeClass}`}
          >
            {config.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-600">{check.description}</p>
        {check.remediation && (
          <Link
            href={check.remediation.href}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            {check.remediation.label}
          </Link>
        )}
      </div>
    </li>
  );
}

export interface PayrollSimulationReviewProps {
  runs?: typeof MOCK_PAYROLL_RUNS;
}

/**
 * Pre-execution simulation review screen. Groups typed simulation results
 * into ready / warning / blocked sections with remediation links. All
 * payloads are privacy-safe; individual salary values never reach this view.
 */
export function PayrollSimulationReview({
  runs = MOCK_PAYROLL_RUNS,
}: PayrollSimulationReviewProps) {
  const simulatableRuns = useMemo(() => runs.filter((r) => r.status !== "cancelled"), [runs]);
  const [runId, setRunId] = useState<string>(simulatableRuns[0]?.id ?? "");
  const [result, setResult] = useState<PayrollSimulationResult | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!runId) {
      setState("empty");
      return;
    }
    let cancelled = false;
    setState("loading");
    fetchPayrollSimulation(runId, runs)
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setState(res ? "loaded" : "empty");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [runId, runs, attempt]);

  const handleRetry = () => setAttempt((n) => n + 1);

  return (
    <section aria-labelledby="simulation-heading" className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 id="simulation-heading" className="text-lg font-semibold text-gray-900">
              Payroll simulation review
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              See what will happen before executing payroll. Private amounts stay hidden.
            </p>
          </div>
          <div>
            <label htmlFor="simulation-run-select" className="block text-sm font-medium text-gray-700 mb-2">
              Payroll run
            </label>
            <select
              id="simulation-run-select"
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {runId === "" && <option value="">Select a run…</option>}
              {simulatableRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.id} · {run.status} · {run.employeeCount} employees
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {state === "loading" && (
        <div
          data-testid="simulation-loading"
          aria-label="Loading simulation results"
          role="status"
          className="bg-white rounded-lg shadow-sm p-6 animate-pulse space-y-4"
        >
          <div className="h-5 bg-gray-200 rounded w-56" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="simulation-error"
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-red-800">Simulation failed</p>
            <p className="text-sm text-red-700 mt-0.5">
              Results could not be loaded. Retry the simulation before executing payroll.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              Retry simulation
            </button>
          </div>
        </div>
      )}

      {state === "empty" && (
        <div data-testid="simulation-empty" className="bg-white rounded-lg shadow-sm p-12 text-center">
          <PlayCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Nothing to simulate yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Select an executable payroll run to preview blockers, warnings, and readiness before
            submitting it on-chain.
          </p>
        </div>
      )}

      {state === "loaded" && result && (
        <>
          <div
            data-testid="simulation-verdict"
            role={result.summary.canExecute ? "status" : "alert"}
            className={`rounded-lg border p-4 flex items-start gap-3 ${
              result.summary.canExecute
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            {result.summary.canExecute ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  result.summary.canExecute ? "text-green-800" : "text-red-800"
                }`}
              >
                {result.summary.canExecute
                  ? "Simulation passed — payroll can execute"
                  : "Simulation found blockers — execution is not safe"}
              </p>
              <p
                className={`text-sm mt-0.5 ${
                  result.summary.canExecute ? "text-green-700" : "text-red-700"
                }`}
              >
                {result.summary.ready} ready · {result.summary.warning} warning
                {result.summary.warning !== 1 ? "s" : ""} · {result.summary.blocked} blocked
              </p>
            </div>
          </div>

          {SECTIONS.map(({ severity, heading }) => {
            const checks = result.checks.filter((c) => c.severity === severity);
            if (checks.length === 0) return null;
            const config = SEVERITY_CONFIG[severity];
            return (
              <div
                key={severity}
                data-testid={`simulation-section-${severity}`}
                className="bg-white rounded-lg shadow-sm overflow-hidden"
              >
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <config.icon
                    className={`w-4 h-4 ${
                      severity === "ready"
                        ? "text-green-600"
                        : severity === "warning"
                        ? "text-amber-500"
                        : "text-red-600"
                    }`}
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold text-gray-900">{heading}</h3>
                </div>
                <ul className="px-4 sm:px-6 py-4 space-y-3">
                  {checks.map((check) => (
                    <CheckRow key={check.id} check={check} />
                  ))}
                </ul>
              </div>
            );
          })}

          <p className="sr-only">
            Simulation generated at {result.generatedAt} for run {result.runId}.
          </p>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
            <EyeOff className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-medium text-indigo-800">Privacy preserved</h3>
              <p className="text-sm text-indigo-700 mt-1">
                Simulation results use aggregate and commitment-based signals only.
                Individual salary values are never included.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default PayrollSimulationReview;
