"use client";

import { CheckCircle2, AlertCircle, Clock, FileText } from "lucide-react";

export type AttachmentStatus = "attached" | "missing" | "pending_review";

export interface AuditReferenceAttachmentStatusCardProps {
  auditReference: string;
  status: AttachmentStatus;
  fileName?: string;
  uploadedDate?: string;
  reviewNotes?: string;
}

export function AuditReferenceAttachmentStatusCard({
  auditReference,
  status,
  fileName,
  uploadedDate,
  reviewNotes,
}: AuditReferenceAttachmentStatusCardProps) {
  const statusConfig = {
    attached: {
      icon: CheckCircle2,
      label: "Attached",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-700",
    },
    missing: {
      icon: AlertCircle,
      label: "Missing",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-700",
    },
    pending_review: {
      icon: Clock,
      label: "Pending review",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-700",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 ${config.textColor}`}
      data-testid={`audit-reference-attachment-${status}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">
            Audit Reference: {auditReference}
          </h3>
          <p className="text-xs font-medium mt-1">{config.label}</p>
          {fileName && (
            <p className="text-xs mt-2">
              File: <span className="font-mono">{fileName}</span>
            </p>
          )}
          {uploadedDate && (
            <p className="text-xs mt-1">
              Uploaded: <span className="font-mono">{uploadedDate}</span>
            </p>
          )}
          {reviewNotes && <p className="text-xs mt-2">{reviewNotes}</p>}
        </div>
      </div>
    </div>
  );
}

export default AuditReferenceAttachmentStatusCard;
