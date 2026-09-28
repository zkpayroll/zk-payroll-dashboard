"use client";

import { useId, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, KeyRound, XCircle } from "lucide-react";
import {
  buildOwnerTransferAuditEntry,
  maskWalletAddress,
  OWNER_TRANSFER_CONFIRMATION_PHRASE,
  reviewOwnerTransfer,
  type OwnerTransferAuditEntry,
  type OwnerTransferParty,
} from "@/src/payroll/ownerTransfer";

const MANUAL_OPTION = "__manual__";

export interface OwnerTransferReviewProps {
  currentOwner: OwnerTransferParty;
  /** Directory members eligible to become owner (the current owner is filtered out). */
  candidates: OwnerTransferParty[];
  /** Payroll runs still in flight; any > 0 blocks the transfer. */
  inFlightRunCount: number;
  /** Receives an audit-safe record when the reviewer submits the transfer. */
  onSubmit?: (entry: OwnerTransferAuditEntry) => void;
}

/**
 * Payroll owner transfer review screen (#546): pick the new owner, review
 * what changes, then type a confirmation phrase before submitting. Addresses
 * are shown masked and no payroll amounts appear anywhere on the screen.
 */
function OwnerTransferReview({
  currentOwner,
  candidates,
  inFlightRunCount,
  onSubmit,
}: OwnerTransferReviewProps) {
  const ids = {
    select: useId(),
    manual: useId(),
    phrase: useId(),
    ack: useId(),
    issues: useId(),
  };
  const eligible = useMemo(
    () => candidates.filter((c) => c.walletAddress.trim() !== currentOwner.walletAddress.trim()),
    [candidates, currentOwner.walletAddress],
  );

  const [selection, setSelection] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitted, setSubmitted] = useState<OwnerTransferAuditEntry | null>(null);

  const candidate: OwnerTransferParty | null =
    selection === MANUAL_OPTION
      ? { id: null, name: "Address entered manually", walletAddress: manualAddress }
      : (eligible.find((c) => c.id === selection) ?? null);

  const review = reviewOwnerTransfer({
    currentOwner,
    candidate,
    inFlightRunCount,
    confirmationText,
    acknowledged,
  });

  if (submitted) {
    return (
      <section
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
        data-testid="owner-transfer-submitted"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Ownership transfer requested</h3>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Transfer from <span className="font-mono">{submitted.fromOwner}</span> to{" "}
          <span className="font-mono">{submitted.toOwner}</span> has been recorded. The new owner must
          accept it from their wallet before it takes effect; until then you remain the owner.
        </p>
      </section>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!review.canSubmit || !candidate) return;
    const entry = buildOwnerTransferAuditEntry(currentOwner, candidate);
    onSubmit?.(entry);
    setSubmitted(entry);
  };

  return (
    <section aria-labelledby="owner-transfer-heading" className="space-y-6" data-testid="owner-transfer-review">
      <div>
        <h2 id="owner-transfer-heading" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-gray-500" aria-hidden="true" />
          Transfer payroll ownership
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          The owner controls the treasury and signs payroll runs. Review the transfer carefully: once the
          new owner accepts it, you lose owner access.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5" noValidate>
        <div className="space-y-2">
          <label htmlFor={ids.select} className="block text-sm font-medium text-gray-700">
            New owner
          </label>
          <select
            id={ids.select}
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select an account…</option>
            {eligible.map((c) => (
              <option key={c.id ?? c.walletAddress} value={c.id ?? ""}>
                {c.name} ({maskWalletAddress(c.walletAddress)})
              </option>
            ))}
            <option value={MANUAL_OPTION}>Enter a wallet address…</option>
          </select>
          {selection === MANUAL_OPTION && (
            <div>
              <label htmlFor={ids.manual} className="block text-sm font-medium text-gray-700 mt-3">
                Wallet address
              </label>
              <input
                id={ids.manual}
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="G…"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4" data-testid="owner-transfer-summary">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Review</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Current owner</p>
              <p className="font-medium text-gray-900">{currentOwner.name}</p>
              <p className="font-mono text-xs text-gray-600">{maskWalletAddress(currentOwner.walletAddress)}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
            <div>
              <p className="text-gray-500 text-xs">New owner</p>
              <p className="font-medium text-gray-900">{candidate?.name ?? "Not selected"}</p>
              {candidate?.walletAddress && (
                <p className="font-mono text-xs text-gray-600">{maskWalletAddress(candidate.walletAddress)}</p>
              )}
            </div>
          </div>
          <ul className="mt-4 list-disc pl-5 text-xs text-gray-600 space-y-1">
            <li>The new owner gets full treasury and payroll execution control.</li>
            <li>You keep owner access until the new owner accepts the transfer.</li>
            <li>After acceptance, only the new owner can transfer ownership again.</li>
          </ul>
        </div>

        {review.warnings.length > 0 && (
          <ul className="space-y-2" data-testid="owner-transfer-warnings">
            {review.warnings.map((w) => (
              <li key={w.code} className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                {w.message}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor={ids.phrase} className="block text-sm font-medium text-gray-700">
              Type <span className="font-mono">{OWNER_TRANSFER_CONFIRMATION_PHRASE}</span> to confirm
            </label>
            <input
              id={ids.phrase}
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              autoComplete="off"
              aria-describedby={review.canSubmit ? undefined : ids.issues}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <label htmlFor={ids.ack} className="flex items-start gap-2 text-sm text-gray-700">
            <input
              id={ids.ack}
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            I understand I will lose owner access once the new owner accepts.
          </label>
        </div>

        {!review.canSubmit && (
          <div id={ids.issues} className="rounded-lg border border-gray-200 p-3" data-testid="owner-transfer-blockers">
            <p className="text-xs font-semibold text-gray-700 mb-2">Before you can transfer:</p>
            <ul className="space-y-1">
              {review.errors.map((err) => (
                <li key={err.code} className="flex gap-2 text-sm text-red-700" data-code={err.code}>
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={!review.canSubmit}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Request ownership transfer
        </button>
      </form>
    </section>
  );
}

export default OwnerTransferReview;
