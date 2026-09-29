"use client";

import React, { useState } from "react";
import { Download, ShieldCheck, FileJson, Table2, X, Eye } from "lucide-react";
import type { SalaryCommitmentAmendment } from "@/lib/sdk/amendments";
import {
  exportAmendmentMetadata,
  AMENDMENT_PRIVACY_NOTICE,
  formatCommitmentShort,
} from "@/lib/privacy/amendments";

export interface AuditAmendmentExportModalProps {
  isOpen: boolean;
  amendments: SalaryCommitmentAmendment[];
  onClose: () => void;
}

export function AuditAmendmentExportModal({
  isOpen,
  amendments,
  onClose,
}: AuditAmendmentExportModalProps) {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    const { data, filename, contentType } = exportAmendmentMetadata(amendments, format);
    const blob = new Blob([data], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid="audit-amendment-export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Audit-friendly amendment export"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-semibold text-gray-900">
              Audit-Friendly Amendment Export
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Privacy Notice Banner */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p data-testid="amendment-export-privacy-notice">{AMENDMENT_PRIVACY_NOTICE}</p>
          </div>

          {/* Export Format Options */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat("json")}
                className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                  format === "json"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-900"
                    : "border-gray-200 hover:bg-gray-50 text-gray-700"
                }`}
              >
                <FileJson className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium">JSON Metadata</p>
                  <p className="text-xs text-gray-500">Structured audit entries</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                  format === "csv"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-900"
                    : "border-gray-200 hover:bg-gray-50 text-gray-700"
                }`}
              >
                <Table2 className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium">CSV Spreadsheet</p>
                  <p className="text-xs text-gray-500">Tabular audit entries</p>
                </div>
              </button>
            </div>
          </div>

          {/* Safe Fields Preview */}
          <div className="border rounded-lg p-4 bg-gray-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Exported Safe Fields ({amendments.length} record{amendments.length !== 1 ? "s" : ""})
              </h4>
              <button
                type="button"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                {isPreviewMode ? "Hide Preview" : "Review Preview"}
              </button>
            </div>

            {isPreviewMode ? (
              <div className="max-h-48 overflow-y-auto space-y-2 text-xs font-mono bg-white p-3 border rounded">
                {amendments.map((a) => (
                  <div key={a.id} className="p-2 border-b border-gray-100 last:border-0">
                    <p className="font-semibold text-gray-900">{a.id} &middot; {a.employeeReference}</p>
                    <p className="text-gray-500">Period: {a.period} | Asset: {typeof a.asset === 'object' ? a.asset.code : a.asset}</p>
                    <p className="text-gray-500">Version: v{a.previousVersion} &rarr; v{a.commitmentVersion}</p>
                    <p className="text-gray-500 truncate">Previous: {formatCommitmentShort(a.previousCommitment)}</p>
                    <p className="text-gray-500 truncate">Next: {formatCommitmentShort(a.nextCommitment)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Commitment version numbers (e.g. v1 &rarr; v2)</li>
                <li>Employee reference identifier (e.g. EMP-2025-001)</li>
                <li>Commitment hashes (previous & next digests)</li>
                <li>Period, asset code, and approval status</li>
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 min-h-[44px] sm:min-h-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0"
          >
            <Download className="w-4 h-4" />
            Download {format.toUpperCase()} Metadata
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditAmendmentExportModal;
