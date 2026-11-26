"use client";

import { AlertTriangle } from "lucide-react";

/** A privacy-safe summary supplied by the transfer integration, not a raw error. */
export type TokenTransferOutcome =
  | { status: "confirmed" }
  | { status: "failed"; reason?: string }
  | { status: "unknown" };

const guidance: Record<string, string> = {
  insufficient_balance: "Check the available token balance and fund the treasury before trying again.",
  destination_rejected: "Review the destination and its token permissions before trying again.",
  asset_unavailable: "Check that the token is supported and available on the selected network.",
  wallet_rejected: "Review the request in your wallet and approve it only if it is correct.",
};

/** Never render provider messages or transaction data: they can contain payroll details. */
export function TokenTransferStatusAlert({ outcome }: { outcome?: TokenTransferOutcome | null }) {
  if (!outcome || outcome.status === "confirmed") return null;

  const isFailure = outcome.status === "failed";
  const reason = isFailure && typeof outcome.reason === "string" ? outcome.reason : "";
  const nextStep = Object.prototype.hasOwnProperty.call(guidance, reason)
    ? guidance[reason]
    : "Review the transfer details privately and contact support if the problem persists.";

  return (
    <div role="alert" data-testid="token-transfer-status" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-red-800">
          {isFailure ? "Token transfer failed" : "Token transfer status is unknown"}
        </p>
        <p className="mt-1 text-sm text-red-700">
          {isFailure ? nextStep : "The network did not confirm the transfer status. Check the transaction status in your wallet or network explorer."}
        </p>
        <p className="mt-1 text-sm text-red-700">
          Check the transaction status before retrying to avoid a duplicate transfer.
        </p>
      </div>
    </div>
  );
}
