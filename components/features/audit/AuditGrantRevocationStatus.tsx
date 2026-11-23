"use client";

import React from "react";
import { Ban, ShieldCheck, Clock, ShieldAlert } from "lucide-react";

export interface AuditGrantRevocationInfo {
  status: "active" | "expiring_soon" | "expired" | "revoked";
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
  grantId?: string;
  auditorName?: string;
}

export interface AuditGrantRevocationStatusProps extends AuditGrantRevocationInfo {
  variant?: "badge" | "banner" | "inline";
  className?: string;
}

/**
 * Format a revocation timestamp safely into a human-readable, privacy-preserving string.
 * Gracefully handles ISO strings, numeric timestamps, null/undefined, and malformed dates.
 */
export function formatRevocationTimestamp(
  timestamp?: string | number | null,
  locale = "en-US",
): string {
  if (!timestamp) {
    return "Timestamp unavailable";
  }

  const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Timestamp unavailable";
  }

  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Pure helper to verify if an audit grant is revoked.
 */
export function isAuditGrantRevoked(grant?: {
  status?: string;
  revokedAt?: string | null;
}): boolean {
  if (!grant) return false;
  return grant.status === "revoked" || Boolean(grant.revokedAt);
}

/**
 * AuditGrantRevocationStatus
 *
 * Surfaces audit grant revocation status and timestamp in the dashboard layer.
 * Strictly guarantees that no confidential salary, employee PII, or circuit secrets
 * are rendered.
 */
export function AuditGrantRevocationStatus({
  status,
  revokedAt,
  revokedBy,
  revocationReason,
  variant = "badge",
  className = "",
}: AuditGrantRevocationStatusProps) {
  const isRevoked = status === "revoked" || Boolean(revokedAt);

  if (variant === "badge") {
    if (isRevoked) {
      return (
        <span
          role="status"
          data-testid="grant-revoked-badge"
          aria-label={`Audit grant revoked on ${formatRevocationTimestamp(revokedAt)}`}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 ${className}`}
        >
          <Ban className="w-3 h-3 text-red-600" aria-hidden="true" /> REVOKED
        </span>
      );
    }

    if (status === "expiring_soon") {
      return (
        <span
          role="status"
          data-testid="grant-expiring-badge"
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 ${className}`}
        >
          <Clock className="w-3 h-3 text-amber-600" aria-hidden="true" /> EXPIRING SOON
        </span>
      );
    }

    if (status === "expired") {
      return (
        <span
          role="status"
          data-testid="grant-expired-badge"
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 ${className}`}
        >
          <Clock className="w-3 h-3 text-gray-600" aria-hidden="true" /> EXPIRED
        </span>
      );
    }

    return (
      <span
        role="status"
        data-testid="grant-active-badge"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 ${className}`}
      >
        <ShieldCheck className="w-3 h-3 text-emerald-600" aria-hidden="true" /> ACTIVE GRANT
      </span>
    );
  }

  if (variant === "inline") {
    if (!isRevoked) return null;

    return (
      <span
        data-testid="grant-revoked-inline"
        className={`inline-flex items-center gap-1.5 text-xs text-red-700 font-medium ${className}`}
      >
        <Ban className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />
        <span>
          Revoked on{" "}
          <strong data-testid="grant-revoked-timestamp">
            {formatRevocationTimestamp(revokedAt)}
          </strong>
        </span>
      </span>
    );
  }

  // variant === "banner"
  if (!isRevoked) return null;

  return (
    <div
      role="status"
      data-testid="grant-revoked-banner"
      className={`p-4 rounded-xl bg-red-50 border border-red-200 text-xs space-y-2 text-red-900 ${className}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 font-bold text-sm text-red-900">
          <Ban className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <span data-testid="grant-revoked-status-title">Audit Grant Revoked</span>
        </div>
        <span
          data-testid="grant-revoked-pill"
          className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-red-200 text-red-900 border border-red-300"
        >
          REVOKED
        </span>
      </div>

      <p className="text-red-700 leading-relaxed">
        This audit grant was revoked on{" "}
        <strong data-testid="grant-revoked-timestamp" className="text-red-950 font-semibold">
          {formatRevocationTimestamp(revokedAt)}
        </strong>
        {revokedBy ? (
          <>
            {" "}by <span data-testid="grant-revoked-by" className="font-semibold text-red-950">{revokedBy}</span>
          </>
        ) : null}
        . Access to decrypt payroll records, export evidence packets, or verify off-chain proofs under this grant is permanently invalidated.
      </p>

      {revocationReason && (
        <div
          data-testid="grant-revoked-reason"
          className="pt-2 border-t border-red-200/70 text-red-800 text-[11px] leading-relaxed"
        >
          <span className="font-semibold text-red-900">Reason:</span> {revocationReason}
        </div>
      )}
    </div>
  );
}

export default AuditGrantRevocationStatus;
