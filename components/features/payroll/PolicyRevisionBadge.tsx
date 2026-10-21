"use client";

import { FileCode } from "lucide-react";
import { getPolicyRevisionInfo } from "@/lib/payroll/policyRevision";

/** Shows the payroll policy revision a run executed under (#751). */
export function PolicyRevisionBadge({ revision }: { revision?: number | null }) {
  const info = getPolicyRevisionInfo(revision);
  return (
    <span
      data-testid="policy-revision-badge"
      data-recorded={info.recorded}
      title={info.detail}
      aria-label={`Policy revision: ${info.recorded ? info.label : "not recorded"}. ${info.detail}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
        info.recorded
          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
          : "border-gray-200 bg-gray-50 text-gray-500"
      }`}
    >
      <FileCode className="h-3 w-3" aria-hidden="true" />
      <span className="font-mono">{info.label}</span>
    </span>
  );
}

export default PolicyRevisionBadge;
