"use client";

import { AlertTriangle, Ban, Download, Eye, FileText, Info, ShieldCheck } from "lucide-react";
import {
  buildExportPreviewFields,
  evaluateExportReviewGate,
  type ExportRedactionSummary,
  type ExportScopeSummary,
} from "@/src/exports/reviewGate";
import type { UserRole } from "@/types";

export interface ExportReviewGateProps {
  isOpen: boolean;
  role: UserRole | null;
  scope: ExportScopeSummary;
  redaction: ExportRedactionSummary;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ExportReviewGate({
  isOpen,
  role,
  scope,
  redaction,
  onConfirm,
  onCancel,
}: ExportReviewGateProps) {
  const review = evaluateExportReviewGate({ role, scope, redaction });
  const previewFields = buildExportPreviewFields(scope, redaction);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-review-gate-heading"
        data-testid="export-review-gate"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 bg-indigo-50 p-6 rounded-t-lg">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2
                id="export-review-gate-heading"
                className="font-semibold text-lg text-gray-900"
              >
                Review export before download
              </h2>
              <p className="mt-1 text-sm text-gray-600">{scope.title}</p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close export review"
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <div className="space-y-4 p-6">
          {review.blockedReasons.length > 0 && (
            <div
              role="alert"
              data-testid="export-review-blocked"
              className="rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <div className="flex items-start gap-2">
                <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Export blocked</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-red-700">
                    {review.blockedReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {review.warnings.length > 0 && (
            <div
              role="status"
              data-testid="export-review-warnings"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <ul className="list-disc space-y-1 pl-4 text-xs text-amber-900">
                  {review.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <dl className="space-y-4">
            <div data-testid="export-review-scope">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                Export scope
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{review.scopeLine}</dd>
              <dd className="mt-1 text-xs text-gray-600">{scope.privacyNotice}</dd>
            </div>

            <div data-testid="export-review-redaction">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Redaction level
              </dt>
              <dd className="mt-1">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                  {redaction.label}
                </span>
              </dd>
              <dd className="mt-1 text-xs text-gray-600">{redaction.description}</dd>
              {redaction.retainedSensitiveFields.length > 0 && (
                <dd className="mt-1 text-xs text-gray-700">
                  Retained sensitive fields: {redaction.retainedSensitiveFields.join(", ")}
                </dd>
              )}
            </div>

            <div data-testid="export-review-access">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Access restrictions
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {review.access.allowed
                  ? `Allowed for ${review.access.roleLabel} role.`
                  : review.access.reason}
              </dd>
              {review.access.allowed && (
                <dd className="mt-1 text-xs text-gray-600">
                  Your role may download this export. Downloads are recorded for audit.
                </dd>
              )}
            </div>

            <div data-testid="export-review-preview">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                Preview (field names only — no values)
              </dt>
              <dd className="mt-1">
                <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                  {previewFields.map((entry) => (
                    <li
                      key={entry.field}
                      className="flex items-center justify-between px-2.5 py-1.5 text-xs"
                    >
                      <span className="text-gray-800">{entry.field}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          entry.redacted
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {entry.redacted ? "REDACTED" : "INCLUDED"}
                      </span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex gap-3 rounded-b-lg border-t border-gray-100 bg-gray-50 p-6 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!review.canProceed}
            data-testid="export-review-confirm"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {review.canProceed ? "Confirm & download" : "Export blocked"}
          </button>
        </div>
      </div>
    </div>
  );
}
