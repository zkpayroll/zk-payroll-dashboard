"use client";

import { AlertTriangle } from "lucide-react";
import type { ReferenceIdOccurrence } from "@/lib/validation/duplicateReferenceId";

interface DuplicateReferenceWarningProps {
  duplicates: ReferenceIdOccurrence[];
}

/**
 * Warns when onboarding input carries the same employee reference id more than
 * once (issue #431), before the rows reach payroll creation. Renders nothing
 * when there are no duplicates, so the common case is unchanged.
 *
 * Reference ids and row numbers only — no salary, commitment, or any other
 * payroll value is read here or shown here.
 */
function DuplicateReferenceWarning({
  duplicates,
}: DuplicateReferenceWarningProps) {
  if (duplicates.length === 0) return null;

  const heading = `${duplicates.length} duplicate employee reference ${
    duplicates.length === 1 ? "id" : "ids"
  } in this input`;

  return (
    <section
      aria-labelledby="duplicate-reference-heading"
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          className="w-4 h-4 text-amber-600 shrink-0"
          aria-hidden="true"
        />
        <h4 id="duplicate-reference-heading" className="text-sm font-semibold text-amber-900">
          {heading}
        </h4>
      </div>

      <p className="text-sm text-amber-800">
        Resolve these before importing: each employee must map to exactly one
        reference id, otherwise payroll creation will match the wrong record.
      </p>

      <ul className="space-y-1.5">
        {duplicates.map((duplicate) => (
          <li key={duplicate.referenceId} className="text-sm text-amber-900">
            <span className="font-mono font-medium">
              {duplicate.referenceId}
            </span>
            <span className="text-amber-800">
              {` — ${duplicate.rowIndexes.length} row${
                duplicate.rowIndexes.length === 1 ? "" : "s"
              }: ${duplicate.rowIndexes.join(", ")}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default DuplicateReferenceWarning;
