"use client";

import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { checkImportReferenceCollision } from "@/lib/validation/importReferenceCollision";

export interface ImportReferenceCollisionWarningProps {
  importReference: string;
  existingReferences: string[];
  className?: string;
  onUseUniqueReference?: () => void;
}

/**
 * Renders a privacy-safe warning when a duplicate external import reference is detected.
 * Never displays salary amounts or sensitive employee data.
 */
export function ImportReferenceCollisionWarning({
  importReference,
  existingReferences,
  className = "",
  onUseUniqueReference,
}: ImportReferenceCollisionWarningProps) {
  const result = checkImportReferenceCollision(importReference, existingReferences);

  if (!result.isCollision) {
    return null;
  }

  return (
    <div
      data-testid="import-reference-collision-warning"
      role="alert"
      className={`rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            Import Reference Collision Warning
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-amber-100 text-amber-800 border border-amber-200">
              {result.normalized}
            </span>
          </h4>
          <p className="text-sm text-amber-800 mt-1">{result.warningMessage}</p>
          <p className="text-xs text-amber-700 mt-1 font-medium">
            Privacy Safe: Salary values and employee details remain fully protected.
          </p>
        </div>
      </div>
      {onUseUniqueReference && (
        <button
          type="button"
          onClick={onUseUniqueReference}
          className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors min-h-[44px] sm:min-h-0 flex items-center justify-center"
        >
          Assign Unique Reference
        </button>
      )}
    </div>
  );
}

export default ImportReferenceCollisionWarning;
