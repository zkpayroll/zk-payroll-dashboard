"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";

export interface ReleasableHold {
  id: string;
  reasonCode: string;
  targetLabel: string;
  placedAt: string;
}

export interface AuditHoldReleaseDialogProps {
  isOpen: boolean;
  hold: ReleasableHold | null;
  onClose: () => void;
  onConfirm: (payload: { holdId: string; releaseNote: string }) => Promise<void>;
}

/** Minimum length of the release justification kept in the audit trail. */
export const MIN_RELEASE_NOTE_LENGTH = 10;

/**
 * Confirmation step before an audit/compliance hold is released (#543).
 *
 * Releasing a hold lets blocked payroll proceed, so it requires a written
 * justification (stored in the audit trail) and an explicit acknowledgement
 * that the hold reason is resolved. Only the hold's reason code, target and
 * placement time are shown — never salary or employee data.
 */
export function AuditHoldReleaseDialog({ isOpen, hold, onClose, onConfirm }: AuditHoldReleaseDialogProps) {
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setNote("");
    setAcknowledged(false);
    setError(null);
  };

  const handleClose = () => {
    if (isLoading) return;
    reset();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isLoading]);

  if (!isOpen || !hold) return null;

  const trimmedNote = note.trim();
  const noteTooShort = trimmedNote.length < MIN_RELEASE_NOTE_LENGTH;
  const canConfirm = !noteTooShort && acknowledged && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (noteTooShort) {
      setError(`Explain why the hold can be released (at least ${MIN_RELEASE_NOTE_LENGTH} characters).`);
      return;
    }
    if (!acknowledged) {
      setError("Confirm that the hold reason has been resolved.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await onConfirm({ holdId: hold.id, releaseNote: trimmedNote });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release hold. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="release-hold-title"
      aria-describedby="release-hold-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" aria-hidden="true" />
            <h2 id="release-hold-title" className="text-base font-semibold text-gray-900">
              Release Audit Hold
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close dialog"
            className="rounded p-1 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div id="release-hold-description" className="space-y-2 text-sm text-gray-600">
            <p>
              Releasing this hold lets payroll for{" "}
              <span className="font-medium text-gray-900">{hold.targetLabel}</span> proceed. This action
              is recorded in the audit trail.
            </p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-lg bg-gray-50 p-3 text-xs">
              <dt className="text-gray-500">Reason code</dt>
              <dd className="font-mono text-gray-900">{hold.reasonCode}</dd>
              <dt className="text-gray-500">Placed</dt>
              <dd className="text-gray-900">{new Date(hold.placedAt).toLocaleString()}</dd>
            </dl>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="release-note" className="block text-sm font-medium text-gray-700">
              Release justification <span className="text-red-500">*</span>
            </label>
            <textarea
              id="release-note"
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError(null);
              }}
              disabled={isLoading}
              aria-invalid={!!error && noteTooShort}
              placeholder="e.g. Auditor confirmed the discrepancy was resolved. Do not include salary amounts or personal identifiers."
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
                if (error) setError(null);
              }}
              disabled={isLoading}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            I confirm the reason for this hold has been resolved.
          </label>

          {error && (
            <p className="text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Release Hold
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuditHoldReleaseDialog;
