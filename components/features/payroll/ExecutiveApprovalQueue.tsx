"use client";

import { useState } from "react";
import { useApprovalQueueStore, type ApprovalDraft } from "@/stores/approvalQueue";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

export function ExecutiveApprovalQueue() {
  const { drafts, approveDraft, rejectDraft } = useApprovalQueueStore();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [selectedDraft, setSelectedDraft] = useState<ApprovalDraft | null>(null);
  const [comment, setComment] = useState("");

  const filteredDrafts = drafts.filter((d) => {
    if (filter === "pending") return d.approvalStatus === "pending_executive_approval";
    if (filter === "approved") return d.approvalStatus === "approved";
    if (filter === "rejected") return d.approvalStatus === "rejected";
    return true;
  });

  const pendingCount = drafts.filter((d) => d.approvalStatus === "pending_executive_approval").length;

  const handleApprove = (draft: ApprovalDraft) => {
    approveDraft(draft.id, "Executive Admin", "Admin", comment || "Approved for execution");
    setSelectedDraft(null);
    setComment("");
  };

  const handleReject = (draft: ApprovalDraft) => {
    rejectDraft(draft.id, "Executive Admin", "Admin", comment || "Rejected during executive review");
    setSelectedDraft(null);
    setComment("");
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
                          : "pending"
                      }
                    />
                    <span className="text-xs text-gray-500">
                      {draft.approvalStatus === "pending_executive_approval"
                        ? "Executive Review Required"
                        : draft.approvalStatus === "approved"
                        ? "Approved for Signing"
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
                        <strong>{hist.approvedBy}</strong> ({hist.role}): {hist.comment}
                      </span>
                      <span className="text-gray-400">{new Date(hist.approvedAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {draft.approvalStatus === "pending_executive_approval" && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-3">
                  <input
                    type="text"
                    placeholder="Add executive review notes/comment (optional)..."
                    value={selectedDraft?.id === draft.id ? comment : ""}
                    onChange={(e) => {
                      setSelectedDraft(draft);
                      setComment(e.target.value);
                    }}
                    className="w-full sm:w-2/3 px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                      onClick={() => handleApprove(draft)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve & Queue for Signing
                    </Button>
                  </div>
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
          ))}
        </div>
      )}
    </div>
  );
}
