"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  maskAddress,
  useWalletRotationStore,
  COOLDOWN_DURATION_MS,
} from "@/stores/walletRotation";
import {
  validatePayoutDestinationChangeApproval,
  validatePayoutDestinationChangeRejection,
} from "@/lib/validation/payoutDestination";
import type { WalletRotationRequest, WalletRotationReasonCode } from "@/types";

export const DESTINATION_REASON_LABELS: Record<WalletRotationReasonCode, string> = {
  scheduled_rotation: "Scheduled Rotation",
  key_compromise: "Key Compromise",
  device_loss: "Device Loss",
  compliance_requirement: "Compliance Requirement",
  emergency: "Emergency",
};

export interface WalletChangeReviewCardProps {
  employeeId?: string;
  employeeName?: string;
  request?: WalletRotationRequest | null;
  isLoading?: boolean;
  error?: string | null;
  reviewerName?: string;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string, reason: string) => void;
  className?: string;
}

export type PayoutDestinationChangeReviewProps = WalletChangeReviewCardProps;

/**
 * Single card review component for a specific payout destination change request.
 */
function SingleDestinationReviewCard({
  request,
  employeeName,
  reviewerName = "Current reviewer",
  onApprove,
  onReject,
  className = "",
}: {
  request: WalletRotationRequest;
  employeeName?: string;
  reviewerName?: string;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string, reason: string) => void;
  className?: string;
}) {
  const approveRequest = useWalletRotationStore((state) => state.approveRequest);
  const rejectRequest = useWalletRotationStore((state) => state.rejectRequest);
  const activateCooldown = useWalletRotationStore((state) => state.activateCooldown);
  const isCooldownActive = useWalletRotationStore((state) =>
    state.isCooldownActive(request.employeeId),
  );

  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAwaitingReview = request.status === "pending";
  const destination = maskAddress(request.newWallet);
  const displayName = employeeName || request.employeeName;
  const reasonLabel =
    DESTINATION_REASON_LABELS[request.reasonCode] || "Scheduled Rotation";

  const handleConfirm = () => {
    setActionError(null);
    const validation = validatePayoutDestinationChangeApproval({
      status: request.status,
      previousWallet: request.previousWallet,
      newWallet: request.newWallet,
      isCooldownActive,
    });

    if (!validation.isValid) {
      setActionError(validation.error);
      return;
    }

    approveRequest(request.id, reviewerName);
    activateCooldown(request.id, request.employeeId, COOLDOWN_DURATION_MS);
    if (onApprove) {
      onApprove(request.id);
    }
  };

  const handleReject = () => {
    setRejectionError(null);
    setActionError(null);
    const validation = validatePayoutDestinationChangeRejection(
      rejectionReason,
      request.status,
    );

    if (!validation.isValid) {
      setRejectionError(validation.error);
      return;
    }

    const trimmedReason = rejectionReason.trim();
    rejectRequest(request.id, reviewerName, trimmedReason);
    if (onReject) {
      onReject(request.id, trimmedReason);
    }
  };

  return (
    <section
      aria-labelledby={`wallet-change-review-heading-${request.id}`}
      className={`rounded-lg border border-amber-300 bg-amber-50 p-5 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-amber-100 p-2 text-amber-700">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id={`wallet-change-review-heading-${request.id}`}
              className="text-sm font-semibold text-amber-950"
            >
              Wallet change requires review
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {request.isEmergency && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  Emergency
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Before next payroll
              </span>
            </div>
          </div>
          <p className="mt-1 text-sm text-amber-900">
            {displayName ? `${displayName}'s` : "This employee's"} destination
            changed. Confirm the masked destination before payroll distribution.
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-amber-800">
            <span className="font-medium">Reason:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100/80 font-medium">
              {reasonLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-amber-200 bg-white p-3">
          <p className="text-xs text-gray-500">Previous destination</p>
          <p className="mt-1 break-all font-mono text-xs text-gray-800">
            {maskAddress(request.previousWallet)}
          </p>
        </div>
        <div className="rounded-md border border-amber-200 bg-white p-3">
          <p className="text-xs text-gray-500">New destination</p>
          <p className="mt-1 break-all font-mono text-xs text-gray-800">
            {destination}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800">
        <p className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Wallet addresses stay masked in this review surface.
        </p>
        <span className="text-amber-700">Cooldown: 24 hours post-approval</span>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800"
        >
          <AlertCircle
            className="h-4 w-4 shrink-0 text-red-600 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="font-semibold">Review action blocked</p>
            <p className="mt-0.5">{actionError}</p>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 font-medium ml-2"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {isAwaitingReview ? (
        <div className="mt-4 space-y-3 border-t border-amber-200 pt-4">
          <label
            className="block text-xs font-medium text-amber-950"
            htmlFor={`wallet-rejection-${request.employeeId}`}
          >
            Rejection reason (required to reject)
          </label>
          <input
            id={`wallet-rejection-${request.employeeId}`}
            value={rejectionReason}
            onChange={(event) => {
              setRejectionReason(event.target.value);
              if (rejectionError) {
                setRejectionError(null);
              }
            }}
            aria-invalid={!!rejectionError}
            aria-describedby={
              rejectionError
                ? `wallet-rejection-error-${request.employeeId}`
                : undefined
            }
            className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 bg-white ${
              rejectionError
                ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                : "border-amber-300 focus:border-amber-500"
            }`}
            placeholder="Explain why this destination should not be used"
          />
          {rejectionError && (
            <p
              id={`wallet-rejection-error-${request.employeeId}`}
              role="alert"
              className="flex items-center gap-1 text-xs text-red-600"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {rejectionError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleConfirm}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Confirm destination
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Reject change
            </button>
          </div>
        </div>
      ) : (
        <p
          role="status"
          className="mt-4 flex items-center gap-1.5 border-t border-amber-200 pt-4 text-sm font-medium text-amber-900"
        >
          <Wallet className="h-4 w-4" aria-hidden="true" />
          Destination confirmed. Complete the wallet cooldown before distribution.
        </p>
      )}
    </section>
  );
}

/**
 * Payout Destination Change Review component.
 *
 * Supports:
 * 1. Single employee review when `employeeId` or `request` is provided.
 * 2. Dashboard review list when neither is provided, listing all pending destination changes.
 */
export function WalletChangeReviewCard({
  employeeId,
  employeeName,
  request: providedRequest,
  isLoading: providedLoading,
  error = null,
  reviewerName,
  onApprove,
  onReject,
  className = "",
}: WalletChangeReviewCardProps) {
  const storeRequest = useWalletRotationStore((state) =>
    employeeId ? state.getRequestForEmployee(employeeId) : undefined,
  );
  const allRequests = useWalletRotationStore((state) => state.requests);
  const storeLoading = useWalletRotationStore((state) => state.isLoading);

  const isLoading = providedLoading ?? storeLoading;

  if (isLoading) {
    return (
      <section
        aria-labelledby="wallet-change-review-heading"
        className="rounded-lg border border-indigo-200 bg-indigo-50 p-5"
      >
        <p
          id="wallet-change-review-heading"
          className="text-sm font-semibold text-indigo-900"
        >
          Wallet change review
        </p>
        <p role="status" className="mt-2 text-sm text-indigo-700">
          Loading wallet change details...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-labelledby="wallet-change-review-heading"
        className="rounded-lg border border-red-200 bg-red-50 p-5"
      >
        <p
          id="wallet-change-review-heading"
          className="text-sm font-semibold text-red-900"
        >
          Wallet change review
        </p>
        <p role="alert" className="mt-2 text-sm text-red-700">
          Unable to load wallet change details. {error}
        </p>
      </section>
    );
  }

  // Single employee / explicit request review mode
  if (employeeId !== undefined || providedRequest !== undefined) {
    const request = providedRequest === undefined ? storeRequest : providedRequest;

    if (
      !request ||
      request.status === "rejected" ||
      request.status === "completed" ||
      request.status === "failed"
    ) {
      return null;
    }

    return (
      <SingleDestinationReviewCard
        request={request}
        employeeName={employeeName}
        reviewerName={reviewerName}
        onApprove={onApprove}
        onReject={onReject}
        className={className}
      />
    );
  }

  // Dashboard multi-request review mode
  const pendingRequests = allRequests.filter((r) => r.status === "pending");

  if (pendingRequests.length === 0) {
    return (
      <section
        aria-labelledby="dashboard-payout-destination-heading"
        className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md bg-green-50 p-2 text-green-700">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="dashboard-payout-destination-heading"
                className="text-sm font-semibold text-gray-900"
              >
                Payout Destination Changes
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                No pending payout destination changes require review.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
            All clear
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="dashboard-payout-destination-heading"
      className={`space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2
            id="dashboard-payout-destination-heading"
            className="text-base font-semibold text-gray-900"
          >
            Payout Destination Changes
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Review and confirm recipient payout destination changes before payroll distribution.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
          {pendingRequests.length} pending review{pendingRequests.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-3">
        {pendingRequests.map((req) => (
          <SingleDestinationReviewCard
            key={req.id}
            request={req}
            employeeName={req.employeeName}
            reviewerName={reviewerName}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </div>
    </section>
  );
}

export const PayoutDestinationChangeReview = WalletChangeReviewCard;

export default WalletChangeReviewCard;