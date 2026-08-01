"use client";

import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { CompanyConfig } from "@/types";
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
  const { result, isValid } = useCompanyConfigValidation(config);
  const errorCount = result.checks.filter((c) => c.status === "error").length;

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
