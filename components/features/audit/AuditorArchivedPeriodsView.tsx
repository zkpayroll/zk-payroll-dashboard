"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, EyeOff, Lock, ShieldAlert } from "lucide-react";
import { useArchiveStore } from "@/stores/archive";
import type { ArchivedPayrollRun } from "@/stores/archive";
import type { UserRole } from "@/types";
import {
  evaluateAuditorArchivedPeriodAccess,
  type AuditorSessionState,
} from "@/lib/audit/auditorArchivedPeriods";

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "operator" || value === "auditor";
}

type SessionCheck = { status: "loading" } | AuditorSessionState;

const COVERAGE_LABEL = {
  available: "Audit bundle available",
  partial: "Partial audit coverage",
  unavailable: "No audit bundle",
} as const;

export interface AuditorArchivedPeriodsViewProps {
  /** Optional `YYYY-MM` period to narrow the view to. */
  period?: string | null;
  /** Override the archive store runs (tests, embedding). */
  runs?: ArchivedPayrollRun[];
}

/**
 * Read-only, redacted view of archived payroll periods for auditors (#858).
 * The role comes from `GET /api/auth/session`, the same source the
 * CompanySwitcher uses, so a stale client-side role cannot unlock it.
 */
export default function AuditorArchivedPeriodsView({
  period,
  runs: runsOverride,
}: AuditorArchivedPeriodsViewProps) {
  const storeRuns = useArchiveStore((s) => s.runs);
  const runs = runsOverride ?? storeRuns;

  const [session, setSession] = useState<SessionCheck>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSession({ status: "loading" });

    fetch("/api/auth/session", { method: "GET", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setSession({ status: res.status >= 500 ? "error" : "unavailable" });
          return;
        }
        const data: unknown = await res.json();
        const role =
          typeof data === "object" && data !== null && "role" in data ? data.role : null;
        if (!cancelled) {
          setSession(isUserRole(role) ? { status: "ready", role } : { status: "unavailable" });
        }
      })
      .catch(() => {
        if (!cancelled) setSession({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const result = useMemo(
    () =>
      session.status === "loading"
        ? null
        : evaluateAuditorArchivedPeriodAccess({ session, runs, period }),
    [session, runs, period],
  );

  return (
    <section
      className="max-w-6xl mx-auto space-y-6"
      data-testid="auditor-archived-periods"
      aria-labelledby="auditor-archived-periods-heading"
    >
      <header className="flex flex-col gap-1">
        <h1
          id="auditor-archived-periods-heading"
          className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2"
        >
          <Archive className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          Archived Payroll Periods
        </h1>
        <p className="text-sm text-gray-500">
          Read-only auditor view. Salary amounts, headcounts, notes and employee identifiers are
          withheld.
        </p>
      </header>

      {result === null && (
        <p role="status" className="text-sm text-gray-500" data-testid="auditor-archive-loading">
          Verifying auditor access…
        </p>
      )}

      {result && !result.ok && (
        <div
          role="alert"
          data-testid="auditor-archive-denied"
          data-code={result.code}
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="font-semibold">{result.title}</h2>
            <p>{result.message}</p>
            {result.action.kind === "retry" ? (
              <button
                type="button"
                className="font-medium underline"
                onClick={() => setAttempt((n) => n + 1)}
              >
                {result.action.label}
              </button>
            ) : (
              <Link className="font-medium underline" href={result.action.href ?? "/"}>
                {result.action.label}
              </Link>
            )}
          </div>
        </div>
      )}

      {result && result.ok && (
        <>
          <div
            className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-xs text-indigo-900"
            data-testid="auditor-archive-privacy-notice"
          >
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
            <span>
              <strong>Read-only:</strong> archived periods cannot be edited, restored or purged from
              this view. Private payroll fields are not loaded into it.
            </span>
          </div>

          {result.skippedCount > 0 && (
            <p role="status" className="text-xs text-amber-700" data-testid="auditor-archive-skipped">
              {result.skippedCount} archived record{result.skippedCount === 1 ? " was" : "s were"}{" "}
              skipped because {result.skippedCount === 1 ? "it is" : "they are"} incomplete. Ask an
              admin to re-archive {result.skippedCount === 1 ? "it" : "them"} if it should appear.
            </p>
          )}

          {result.periods.length === 0 ? (
            <p
              className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500"
              data-testid="auditor-archive-empty"
            >
              No payroll periods have been archived yet. Archived periods appear here once an admin
              archives a finalized run.
            </p>
          ) : (
            <ul className="space-y-4" aria-label="Archived payroll periods">
              {result.periods.map((p) => (
                <li
                  key={p.payPeriod}
                  data-testid={`auditor-period-${p.payPeriod}`}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-gray-900">Period {p.payPeriod}</h2>
                    <span className="text-xs text-gray-500">
                      {p.runCount} run{p.runCount === 1 ? "" : "s"} · {p.assets.join(", ")} ·{" "}
                      {COVERAGE_LABEL[p.auditCoverage]}
                    </span>
                  </div>
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th scope="col" className="px-4 py-2">Run</th>
                        <th scope="col" className="px-4 py-2">Employer</th>
                        <th scope="col" className="px-4 py-2">Status</th>
                        <th scope="col" className="px-4 py-2">Transaction</th>
                        <th scope="col" className="px-4 py-2">Evidence</th>
                        <th scope="col" className="px-4 py-2">Total paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {p.runs.map((r) => (
                        <tr key={r.id} data-testid={`auditor-run-${r.id}`}>
                          <td className="px-4 py-2 font-mono">{r.payrollRunId}</td>
                          <td className="px-4 py-2">{r.employerName}</td>
                          <td className="px-4 py-2">
                            {r.status}
                            {r.settlementPending ? " · settlement pending" : ""}
                          </td>
                          <td className="px-4 py-2 font-mono">{r.transactionHashPreview}</td>
                          <td className="px-4 py-2">{r.bundleId ?? "—"}</td>
                          <td className="px-4 py-2 text-gray-400">
                            <span className="inline-flex items-center gap-1">
                              <EyeOff className="h-3 w-3" aria-hidden="true" />
                              Withheld
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
