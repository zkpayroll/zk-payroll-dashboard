"use client";

import { useState } from "react";
import { Check, Eye, FileText, Paperclip, ShieldCheck } from "lucide-react";
import type { PayrollAttachmentMetadata } from "@/types/models";

interface AttachmentMetadataViewerProps {
  metadata?: PayrollAttachmentMetadata | null;
}

function formatUploadTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function AttachmentMetadataViewer({ metadata }: AttachmentMetadataViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!metadata) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Paperclip className="w-3.5 h-3.5" />
        Attachment metadata unavailable
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={`attachment-metadata-${metadata.checksum}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
      >
        <Eye className="w-3.5 h-3.5" />
        View attachment metadata
      </button>

      {isOpen && (
        <div
          id={`attachment-metadata-${metadata.checksum}`}
          role="region"
          aria-label="Attachment metadata"
          className="mt-3 rounded-md border border-indigo-100 bg-white p-3 text-xs shadow-sm"
        >
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 break-words">
                {metadata.fileName}
              </p>
              <p className="mt-1 text-gray-500">
                Metadata only. Restricted file contents are not available here.
              </p>
            </div>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">Uploaded</dt>
              <dd className="text-gray-800">
                {formatUploadTime(metadata.uploadedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Owner</dt>
              <dd className="text-gray-800 break-words">{metadata.owner}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Access scope</dt>
              <dd className="inline-flex items-center gap-1 text-gray-800">
                <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                {metadata.accessScope === "full-audit"
                  ? "Full audit"
                  : "Read-only"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Checksum</dt>
              <dd className="break-all font-mono text-gray-800">
                {metadata.checksum}
              </dd>
            </div>
          </dl>
          <p className="mt-3 inline-flex items-center gap-1 text-green-700">
            <Check className="h-3.5 w-3.5" />
            File contents remain protected
          </p>
        </div>
      )}
    </div>
  );
}

export default AttachmentMetadataViewer;
