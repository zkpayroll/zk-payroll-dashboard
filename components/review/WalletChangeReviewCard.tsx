"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, ShieldAlert, Wallet, XCircle } from "lucide-react";
import { maskAddress, useWalletRotationStore } from "@/stores/walletRotation";
import type { WalletRotationRequest } from "@/types";

export interface WalletChangeReviewCardProps {
  employeeId: string;
  employeeName?: string;
  request?: WalletRotationRequest | null;
  isLoading?: boolean;
  error?: string | null;
}

export function WalletChangeReviewCard({
  employeeId,
  employeeName,
  request: providedRequest,
  isLoading: providedLoading,
  error = null,
}: WalletChangeReviewCardProps) {
  const storeRequest = useWalletRotationStore((state) => state.getRequestForEmployee(employeeId));
  const storeLoading = useWalletRotationStore((state) => state.isLoading);
  const approveRequest = useWalletRotationStore((state) => state.approveRequest);
  const rejectRequest = useWalletRotationStore((state) => state.rejectRequest);
  const [rejectionReason, setRejectionReason] = useState("");

  const request = providedRequest === undefined ? storeRequest : providedRequest;
  const isLoading = providedLoading ?? storeLoading;

  if (isLoading) {
    return (
      <section aria-labelledby="wallet-change-review-heading" className="rounded-lg border border-indigo-200 bg-indigo-50 p-5">
        <p id="wallet-change-review-heading" className="text-sm font-semibold text-indigo-900">Wallet change review</p>
        <p role="status" className="mt-2 text-sm text-indigo-700">Loading wallet change details...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-labelledby="wallet-change-review-heading" className="rounded-lg border border-red-200 bg-red-50 p-5">
        <p id="wallet-change-review-heading" className="text-sm font-semibold text-red-900">Wallet change review</p>
        <p role="alert" className="mt-2 text-sm text-red-700">Unable to load wallet change details. {error}</p>
      </section>
    );
  }

  if (!request || request.status === "rejected" || request.status === "completed" || request.status === "failed") {
    return null;
  }

  const isAwaitingReview = request.status === "pending";
  const destination = maskAddress(request.newWallet);

  return (
    <section aria-labelledby="wallet-change-review-heading" className="rounded-lg border border-amber-300 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-amber-100 p-2 text-amber-700">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="wallet-change-review-heading" className="text-sm font-semibold text-amber-950">Wallet change requires review</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Before next payroll
            </span>
          </div>
          <p className="mt-1 text-sm text-amber-900">
            {employeeName ? `${employeeName}'s` : "This employee's"} destination changed. Confirm the masked destination before payroll distribution.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-amber-200 bg-white p-3">
          <p className="text-xs text-gray-500">Previous destination</p>
          <p className="mt-1 break-all font-mono text-xs text-gray-800">{maskAddress(request.previousWallet)}</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-white p-3">
          <p className="text-xs text-gray-500">New destination</p>
          <p className="mt-1 break-all font-mono text-xs text-gray-800">{destination}</p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-800">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        Wallet addresses stay masked in this review surface.
      </p>

      {isAwaitingReview ? (
        <div className="mt-4 space-y-3 border-t border-amber-200 pt-4">
          <label className="block text-xs font-medium text-amber-950" htmlFor={`wallet-rejection-${employeeId}`}>
            Rejection reason (required to reject)
          </label>
          <input
            id={`wallet-rejection-${employeeId}`}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900"
            placeholder="Explain why this destination should not be used"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => approveRequest(request.id, "Current reviewer")}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Confirm destination
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => rejectRequest(request.id, "Current reviewer", rejectionReason.trim())}
              disabled={!rejectionReason.trim()}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Reject change
            </button>
          </div>
        </div>
      ) : (
        <p role="status" className="mt-4 flex items-center gap-1.5 border-t border-amber-200 pt-4 text-sm font-medium text-amber-900">
          <Wallet className="h-4 w-4" aria-hidden="true" />
          Destination confirmed. Complete the wallet cooldown before distribution.
        </p>
      )}
    </section>
  );
}

export default WalletChangeReviewCard;