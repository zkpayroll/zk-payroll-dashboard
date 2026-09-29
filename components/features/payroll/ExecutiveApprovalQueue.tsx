"use client";

import { useEffect, useState } from "react";
import { CORRECTION_REQUEST_TTL_MS, useApprovalQueueStore, type ApprovalDraft } from "@/stores/approvalQueue";
import type {
  ApprovalActionResult,
  ApprovalConflictDetail,
} from "@/lib/payroll/approvalConflict";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  FileText,
  ArrowRight,
  MessageSquareWarning,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import DelegatedApproverPanel from "@/components/features/approvals/DelegatedApproverPanel";

function correctionExpiry(draft: ApprovalDraft): number | null {
  if (draft.correctionExpiresAt) {
    const storedExpiry = new Date(draft.correctionExpiresAt).getTime();
    return Number.isNaN(storedExpiry) ? null : storedExpiry;
  }
  const requestedAt = draft.approvalHistory
    ?.slice()
    .reverse()
    .find((entry) => entry.action === "correction_requested")?.approvedAt;
  if (!requestedAt) return null;
  const requestedTime = new Date(requestedAt).getTime();
  return Number.isNaN(requestedTime) ? null : requestedTime + CORRECTION_REQUEST_TTL_MS;
}

export function ExecutiveApprovalQueue() {
  const { drafts, approveDraft, rejectDraft, requestCorrection, resubmitDraft } =
    useApprovalQueueStore();
  const [filter, setFilter] = useState<
    "pending" | "corrections" | "approved" | "rejected" | "all"
  >("pending");
  const [selectedDraft, setSelectedDraft] = useState<ApprovalDraft | null>(null);
  const [comment, setComment] = useState("");
  const [correctionErrorId, setCorrectionErrorId] = useState<string | null>(null);
  // #552 — set when a decision is refused because the draft no longer holds
  // the state this reviewer was looking at (someone else acted first).
  const [conflict, setConflict] = useState<ApprovalConflictDetail | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /**
   * Applies a decision and reports a conflict instead of silently overwriting.
   *
   * The store returns the gate's verdict. On conflict the row is left alone and
   * the reviewer keeps their comment and selection, because the fix is to
   * reload and re-read the payroll — not to retype what they had already
   * written.
   */
  const applyDecision = (
    act: () => ApprovalActionResult,
    resetSelection: boolean,
  ) => {
    const result = act();
    if (!result.ok) {
      setConflict(result.conflict);
      return;
    }
    setConflict(null);
    if (resetSelection) {
      setSelectedDraft(null);
      setComment("");
      setCorrectionErrorId(null);
    }
  };

  const filteredDrafts = drafts.filter((d) => {
    if (filter === "pending") return d.approvalStatus === "pending_executive_approval";
    if (filter === "corrections") return d.approvalStatus === "correction_requested";
    if (filter === "approved") return d.approvalStatus === "approved";
    if (filter === "rejected") return d.approvalStatus === "rejected";
    return true;
  });

  const pendingCount = drafts.filter((d) => d.approvalStatus === "pending_executive_approval").length;
  const correctionsCount = drafts.filter((d) =>
    d.approvalStatus === "correction_requested" &&
    (correctionExpiry(d) === null || correctionExpiry(d)! > now),
  ).length;

  const currentComment = (draft: ApprovalDraft) => (selectedDraft?.id === draft.id ? comment : "");

  const handleApprove = (draft: ApprovalDraft) => {
    applyDecision(
      () => approveDraft(draft.id, "Executive Admin", "Admin", comment || "Approved for execution"),
      true,
    );
  };

  const handleReject = (draft: ApprovalDraft) => {
    applyDecision(
      () => rejectDraft(draft.id, "Executive Admin", "Admin", comment || "Rejected during executive review"),
      true,
    );
  };

  const handleRequestCorrection = (draft: ApprovalDraft) => {
    const trimmed = currentComment(draft).trim();
    if (!trimmed) {
      setCorrectionErrorId(draft.id);
      return;
    }
    applyDecision(
      () => requestCorrection(draft.id, "Executive Admin", "Admin", trimmed),
      true,
    );
  };

  const handleResubmit = (draft: ApprovalDraft) => {
    applyDecision(() => resubmitDraft(draft.id, "Payroll Drafter", "Operator"), false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            Executive Approval Queue
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and authorize high-value payroll drafts prior to cryptographic signing and network dispatch.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-sm text-indigo-800">
          <AlertTriangle className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold">{pendingCount}</span> draft(s) awaiting review
        </div>
      </div>

      <div className="flex items-center gap-2 border-b pb-2">
        <button
          onClick={() => setFilter("pending")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            filter === "pending"
              ? "bg-indigo-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Pending Review ({pendingCount})
        </button>
        <button
          onClick={() => setFilter("corrections")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            filter === "corrections"
              ? "bg-amber-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Corrections Requested ({correctionsCount})
        </button>
        <button
          onClick={() => setFilter("approved")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            filter === "approved"
              ? "bg-green-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Approved
        </button>
        <button
          onClick={() => setFilter("rejected")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            filter === "rejected"
              ? "bg-red-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Rejected
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            filter === "all"
              ? "bg-gray-800 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          All ({drafts.length})
        </button>
      </div>

{/* #552 — a decision was refused because the payroll moved on. */}
{conflict && (
  <div
    role="alert"
    aria-live="assertive"
    data-testid="approval-conflict-banner"
    className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm"
  >
    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="font-medium text-amber-900">
        Approval conflict — nothing was changed
      </p>
      <p className="text-amber-800 mt-0.5 break-words">{conflict.message}</p>
      <p className="text-amber-700 mt-1 text-xs">
        Current state: {conflict.currentStatusLabel}
        {conflict.decidedAt
          ? ` · recorded ${new Date(conflict.decidedAt).toLocaleString()}`
          : ""}
      </p>
      <p className="text-amber-700 mt-2 text-xs">
        Your comment has been kept. Reload the queue to review the current
        state before deciding again.
      </p>
    </div>
  </div>
)}

      {filteredDrafts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-dashed rounded-xl">
          <CheckCircle2 className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No payroll drafts in this queue</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
            All submitted high-value payroll runs have been reviewed or processed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDrafts.map((draft) => (
            (() => {
              const expiry = draft.approvalStatus === "correction_requested" ? correctionExpiry(draft) : null;
              const correctionExpired = expiry !== null && expiry <= now;
              return (
            <div
              key={draft.id}
              className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow space-y-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-indigo-600">{draft.id}</span>
                    <StatusBadge
                      status={
                        draft.approvalStatus === "approved"
                          ? "verified"
                          : draft.approvalStatus === "rejected"
                          ? "failed"
                          : draft.approvalStatus === "correction_requested"
                          ? "correction_requested"
                          : "pending"
                      }
                    />
                    <span className="text-xs text-gray-500">
                      {draft.approvalStatus === "pending_executive_approval"
                        ? "Executive Review Required"
                        : draft.approvalStatus === "approved"
                        ? "Approved for Signing"
                        : draft.approvalStatus === "correction_requested"
                        ? correctionExpired ? "Correction Request Expired" : "Awaiting Corrections from Drafter"
                        : "Rejected"}
                    </span>
                  </div>
                  {draft.notes && <p className="text-sm text-gray-700 mt-1 font-medium">{draft.notes}</p>}
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-gray-900">
                    ${draft.totalAmount.toLocaleString()} USD
                  </div>
                  <div className="text-xs text-gray-500">{draft.employeeCount} Employees</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gray-50 p-3 rounded-lg border text-gray-600">
                <div>
                  <span className="font-semibold text-gray-700">Created:</span>{" "}
                  {new Date(draft.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">ZK Proof:</span>{" "}
                  <span className="font-mono">{draft.proof ? "Generated (Verified)" : "Pending"}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Company ID:</span> {draft.companyId}
                </div>
              </div>

              {draft.approvalHistory && draft.approvalHistory.length > 0 && (
                <div className="border-t pt-3 space-y-1">
                  <h4 className="text-xs font-semibold text-gray-700">Review History:</h4>
                  {draft.approvalHistory.map((hist, idx) => (
                    <div key={idx} className="text-xs text-gray-600 flex justify-between">
                      <span>
                        <strong>{hist.approvedBy}</strong> ({hist.role})
                        {hist.action === "correction_requested" && (
                          <span className="text-amber-700 font-medium"> requested corrections</span>
                        )}
                        {hist.action === "resubmitted" && (
                          <span className="text-indigo-700 font-medium"> resubmitted</span>
                        )}
                        : {hist.comment}
                      </span>
                      <span className="text-gray-400">{new Date(hist.approvedAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {draft.approvalStatus === "pending_executive_approval" && (
                <div className="flex flex-col gap-2 border-t pt-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <input
                      type="text"
                      placeholder="Add executive review notes/comment (required for corrections)..."
                      value={currentComment(draft)}
                      onChange={(e) => {
                        setSelectedDraft(draft);
                        setComment(e.target.value);
                        if (correctionErrorId === draft.id) setCorrectionErrorId(null);
                      }}
                      aria-describedby={
                        correctionErrorId === draft.id ? `correction-error-${draft.id}` : undefined
                      }
                      className="w-full sm:w-2/3 px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                        onClick={() => handleReject(draft)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject Draft
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-700 border-amber-200 hover:bg-amber-50 text-xs"
                        onClick={() => handleRequestCorrection(draft)}
                      >
                        <MessageSquareWarning className="h-4 w-4 mr-1" />
                        Request Correction
                      </Button>
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                        onClick={() => handleApprove(draft)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve & Queue for Signing
                      </Button>
                    </div>
                  </div>
                  {correctionErrorId === draft.id && (
                    <p
                      id={`correction-error-${draft.id}`}
                      role="alert"
                      className="text-xs text-red-600"
                    >
                      Add a comment describing what needs to change before requesting corrections.
                    </p>
                  )}
                </div>
              )}

              {draft.approvalStatus === "correction_requested" && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-3 bg-amber-50 -mx-5 -mb-5 px-5 py-3 rounded-b-xl">
                  <p className="text-xs text-amber-800">
                    {correctionExpired
                      ? "This correction request expired after seven days. Ask an executive to issue a new request before resubmitting."
                      : `Corrections requested. Address the feedback and resubmit before ${expiry ? new Date(expiry).toLocaleString() : "the request expires"}.`}
                  </p>
                  <Button
                    size="sm"
                    disabled={correctionExpired}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0"
                    onClick={() => handleResubmit(draft)}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Resubmit for Review
                  </Button>
                </div>
              )}

              {draft.approvalStatus === "approved" && (
                <div className="flex justify-end border-t pt-3">
                  <Link href="/payroll/execute">
                    <Button size="sm" variant="outline" className="text-xs text-indigo-600 border-indigo-200">
                      Proceed to Payroll Execution Wizard
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
              );
            })()
          ))}
        </div>
      )}

      <DelegatedApproverPanel />
    </div>
  );
}

