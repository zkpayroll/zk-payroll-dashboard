"use client";

import { useState } from "react";
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useApproverThresholdStore } from "@/stores/approverThreshold";

function ApproverThresholdRotation() {
  const currentPolicy = useApproverThresholdStore((s) => s.currentPolicy);
  const batchesOnCurrentPolicy = useApproverThresholdStore((s) => s.batchesOnCurrentPolicy);
  const pendingRequest = useApproverThresholdStore((s) => s.pendingRequest);
  const proposeRotation = useApproverThresholdStore((s) => s.proposeRotation);
  const confirmRotation = useApproverThresholdStore((s) => s.confirmRotation);
  const cancelRotation = useApproverThresholdStore((s) => s.cancelRotation);

  const [proposedValue, setProposedValue] = useState(String(currentPolicy.requiredApprovals));
  const [error, setError] = useState<string | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);

  const handlePropose = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(proposedValue);

    const result = proposeRotation(parsed, "Current User");
    if (!result.success) {
      setError(result.error);
      return;
    }
    setError(null);
    setConfirmChecked(false);
  };

  const handleConfirm = () => {
    if (!confirmChecked) return;
    confirmRotation();
    setJustConfirmed(true);
    toast.success("Approval threshold updated", {
      description: `Policy version ${currentPolicy.version + 1} is now effective.`,
    });
  };

  const handleCancel = () => {
    cancelRotation();
    setConfirmChecked(false);
  };

  if (justConfirmed && !pendingRequest) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6" data-testid="threshold-success-state">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Threshold rotation confirmed</h3>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Approval threshold is now {currentPolicy.requiredApprovals} approver
          {currentPolicy.requiredApprovals === 1 ? "" : "s"} (policy version {currentPolicy.version}).
        </p>
        <button
          type="button"
          onClick={() => setJustConfirmed(false)}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Propose another change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="approver-threshold-rotation">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Approver Threshold Rotation</h2>
        <p className="text-sm text-gray-500 mt-1">
          Change how many approvers must sign off on a payroll batch before it can execute.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current threshold</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{currentPolicy.requiredApprovals}</p>
          <p className="text-xs text-gray-500 mt-1">Policy version {currentPolicy.version}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending threshold</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {pendingRequest ? pendingRequest.proposedRequiredApprovals : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {pendingRequest ? "Awaiting confirmation" : "No pending change"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Locked batches</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{batchesOnCurrentPolicy.length}</p>
          <p className="text-xs text-gray-500 mt-1">On version {currentPolicy.version}</p>
        </div>
      </div>

      {!pendingRequest ? (
        <form
          onSubmit={handlePropose}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
          aria-label="Propose threshold change"
        >
          <div>
            <label htmlFor="proposed-threshold" className="block text-xs font-medium text-gray-700 mb-1">
              New required approvals
            </label>
            <input
              id="proposed-threshold"
              type="number"
              value={proposedValue}
              onChange={(e) => setProposedValue(e.target.value)}
              className="w-full sm:w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            Preview change
          </button>
        </form>
      ) : (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-700">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Confirm threshold rotation</h3>
          </div>

          <p className="text-sm text-gray-700">
            Changing the required approvals from{" "}
            <strong>{pendingRequest.currentPolicy.requiredApprovals}</strong> to{" "}
            <strong>{pendingRequest.proposedRequiredApprovals}</strong> will take effect immediately as
            policy version {pendingRequest.currentPolicy.version + 1}.
          </p>

          {pendingRequest.affectedBatchIds.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                {pendingRequest.affectedBatchIds.length} batch
                {pendingRequest.affectedBatchIds.length === 1 ? "" : "es"} already locked to policy version{" "}
                {pendingRequest.currentPolicy.version} will keep requiring{" "}
                {pendingRequest.currentPolicy.requiredApprovals} approval
                {pendingRequest.currentPolicy.requiredApprovals === 1 ? "" : "s"} — only new batches will use
                the new threshold.
              </span>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="mt-0.5"
            />
            I understand this change takes effect immediately for new batches.
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!confirmChecked}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Confirm change
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApproverThresholdRotation;
