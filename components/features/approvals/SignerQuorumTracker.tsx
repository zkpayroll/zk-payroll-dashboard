"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useSigningStore } from "@/stores/signing";
import type { Signer } from "@/stores/signing";
import type { SignatureStatus } from "@/types/roles";
import { roleLabel, statusLabel } from "@/types/roles";

const STATUS_CONFIG: Record<
  SignatureStatus,
  { color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  signed: {
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  },
  missing: {
    color: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200",
    icon: <Clock className="w-4 h-4 text-gray-400" />,
  },
  rejected: {
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: <XCircle className="w-4 h-4 text-red-500" />,
  },
  expired: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  },
  unauthorized: {
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: <ShieldAlert className="w-4 h-4 text-purple-500" />,
  },
};

function SignerRow({ signer }: { signer: Signer }) {
  const config = STATUS_CONFIG[signer.status];
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${config.bg} ${config.border}`}
    >
      <div className="shrink-0">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{signer.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {roleLabel(signer.role)}
        </span>
      </div>
      <span className={`text-xs font-medium ${config.color}`}>
        {statusLabel(signer.status)}
      </span>
    </div>
  );
}

export default function SignerQuorumTracker() {
  const { mode, threshold, requiredRoles, signers, getProgress, getRequestSummary } =
    useSigningStore();
  const progress = getProgress();
  const [copied, setCopied] = useState(false);

  const pct =
    progress.required > 0
      ? Math.min(100, Math.round((progress.collected / progress.required) * 100))
      : 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getRequestSummary());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Signer Quorum</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track required approvals, collected signatures, and outstanding roles
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50"
        >
          <Copy className="w-4 h-4" />
          {copied ? "Copied" : "Copy request summary"}
        </button>
      </div>

      {/* Threshold progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {mode === "unanimous" ? "Unanimous approval" : "Threshold progress"}
          </span>
          <span className="text-muted-foreground">
            {progress.collected}/{progress.required} signatures
            {mode === "threshold" && ` (threshold ${threshold})`}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            role="progressbar"
            aria-valuenow={progress.collected}
            aria-valuemin={0}
            aria-valuemax={progress.required}
            className={`h-full rounded-full ${progress.thresholdMet ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Submission status */}
      {progress.blocked ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Submission blocked
            </p>
            <p className="text-sm text-red-700 mt-0.5">
              {progress.rejected.length > 0
                ? "One or more approvals were rejected. Resolve them before submitting."
                : progress.expired.length > 0
                  ? "One or more approvals have expired. Request fresh signatures."
                  : progress.unauthorized.length > 0
                    ? "An unauthorized signer was detected. Remove them before submitting."
                    : "The approval quorum has not been reached yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-green-800">
            Quorum reached — payroll is ready to submit.
          </p>
        </div>
      )}

      {/* Missing roles */}
      {progress.missingRoles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            Awaiting approval ({progress.missingRoles.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {progress.missingRoles.map((role) => (
              <span
                key={role}
                className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200"
              >
                {roleLabel(role)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Required roles overview */}
      {requiredRoles.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Required roles: {requiredRoles.map(roleLabel).join(", ")}
        </p>
      )}

      {/* Signers */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Signers ({signers.length})</h3>
        {signers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No signers assigned yet.</p>
        ) : (
          signers.map((signer) => <SignerRow key={signer.id} signer={signer} />)
        )}
      </div>
    </div>
  );
}
