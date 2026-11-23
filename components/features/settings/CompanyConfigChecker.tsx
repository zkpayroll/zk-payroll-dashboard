"use client";

import { CheckCircle, XCircle, AlertTriangle, ArrowUpCircle } from "lucide-react";
import { CURRENT_CONFIG_SCHEMA_VERSION, type CompanyConfig } from "@/types";
import { useCompanyConfigValidation } from "@/hooks/useCompanyConfigValidation";
import type { ConfigCheck } from "@/lib/validateCompanyConfig";

interface CompanyConfigCheckerProps {
  config: CompanyConfig;
}

function StatusIcon({ status }: { status: ConfigCheck["status"] }) {
  if (status === "ok") return <CheckCircle className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />;
  if (status === "error") return <XCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />;
  return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" aria-hidden="true" />;
}

export function CompanyConfigChecker({ config }: CompanyConfigCheckerProps) {
  const { result, isValid, migration } = useCompanyConfigValidation(config);
  const errorCount = result.checks.filter((c) => c.status === "error").length;

  // Single actionable banner describing the organization policy migration state.
  const migrationBannerClass =
    migration.status === "current"
      ? migration.valid
        ? "bg-green-50 text-green-800 border border-green-200"
        : "bg-red-50 text-red-800 border border-red-200"
      : migration.status === "migratable"
        ? "bg-amber-50 text-amber-800 border border-amber-200"
        : "bg-red-50 text-red-800 border border-red-200";

  // Actionable subset: only migration-relevant failed/warning checks.
  const migrationChecks = [...migration.checks, ...migration.incompatibilities].filter(
    (check) => check.status !== "ok",
  );

  return (
    <section aria-labelledby="config-health-heading" className="space-y-3">
      <h3 id="config-health-heading" className="text-sm font-semibold text-gray-900">
        Configuration Health
      </h3>

      <div
        role="status"
        className={`rounded-lg px-4 py-3 text-sm font-medium ${
          isValid
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}
      >
        {isValid ? "All checks passed" : `${errorCount} issue${errorCount !== 1 ? "s" : ""} found`}
      </div>

      <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${migrationBannerClass}`}>
        {migration.message}
      </div>

      {migrationChecks.length > 0 && (
        <div role="note" className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
            <ArrowUpCircle className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
            {`Migration review — schema version ${migration.schemaVersion}`}
          </p>
          <ul className="mt-2 space-y-1.5">
            {migrationChecks.map((check) => (
              <li key={check.id} className="flex items-start gap-2">
                <StatusIcon status={check.status} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{check.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{check.message}</p>
                </div>
              </li>
            ))}
          </ul>
          {!migration.alreadyCurrent && migration.status !== "unsupported-version" && (
            <p className="mt-2 text-xs text-gray-500">
              {`Resolve these before migrating to schema version ${CURRENT_CONFIG_SCHEMA_VERSION}.`}
            </p>
          )}
        </div>
      )}

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {result.checks.map((check) => (
          <li key={check.id} className="flex items-start gap-3 px-4 py-3">
            <StatusIcon status={check.status} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{check.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{check.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
