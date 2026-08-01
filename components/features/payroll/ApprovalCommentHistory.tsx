"use client";

import { useState, useMemo } from "react";
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  Edit,
  Send,
  Paperclip,
  Clock,
  User,
} from "lucide-react";
import { MOCK_APPROVAL_COMMENTS, MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { ApprovalAction } from "@/types";

// ─── Action metadata ─────────────────────────────────────────────────────────

const ACTION_META: Record<
  ApprovalAction,
  {
    icon: typeof MessageSquare;
    label: string;
    bg: string;
    text: string;
    dot: string;
  }
> = {
  approved: {
    icon: CheckCircle,
    label: "Approved",
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  requested_changes: {
    icon: Edit,
    label: "Changes Requested",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  commented: {
    icon: MessageSquare,
    label: "Comment",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  submitted: {
    icon: Send,
    label: "Submitted",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

function ApprovalCommentHistory() {
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(
    null,
  );
  const [actionFilter, setActionFilter] = useState<ApprovalAction | "all">(
    "all",
  );

  // Group comments by payroll
  const payrollOptions = useMemo(() => {
    const ids = new Set(MOCK_APPROVAL_COMMENTS.map((c) => c.payrollId));
    return MOCK_PAYROLL_RUNS.filter((r) => ids.has(r.id));
  }, []);

  const filteredComments = useMemo(() => {
    let comments = MOCK_APPROVAL_COMMENTS;
    if (selectedPayrollId) {
      comments = comments.filter((c) => c.payrollId === selectedPayrollId);
    }
    if (actionFilter !== "all") {
      comments = comments.filter((c) => c.action === actionFilter);
    }
    return comments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [selectedPayrollId, actionFilter]);


  return (
    <section aria-labelledby="approval-comments-heading" className="space-y-4">
      <h2
        id="approval-comments-heading"
        className="text-lg font-semibold text-gray-900"
      >
        Approval Comment History
      </h2>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="payroll-select" className="sr-only">
            Select payroll run
          </label>
          <select
            id="payroll-select"
            value={selectedPayrollId ?? ""}
            onChange={(e) =>
              setSelectedPayrollId(e.target.value || null)
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All payroll runs</option>
            {payrollOptions.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.id} — {formatDate(pr.createdAt)} ({pr.status})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1 flex-wrap">
          {(["all", "submitted", "approved", "rejected", "requested_changes", "commented"] as const).map(
            (action) => (
              <button
                key={action}
                type="button"
                onClick={() => setActionFilter(action)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  actionFilter === action
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {action === "all"
                  ? "All"
                  : ACTION_META[action].label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* ── Comments timeline ────────────────────────────────────────────── */}
      {filteredComments.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <MessageSquare className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900">
            No comments found
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {selectedPayrollId
              ? "This payroll run has no matching comments."
              : "No approval comments recorded yet."}
          </p>
        </div>
      )}

      <div className="relative">
        {/* Timeline line */}
        {filteredComments.length > 0 && (
          <div
            className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"
            aria-hidden="true"
          />
        )}

        <ul className="space-y-4">
          {filteredComments.map((comment) => {
            const meta = ACTION_META[comment.action];
            const ActionIcon = meta.icon;

            return (
              <li key={comment.id} className="relative pl-12">
                {/* Timeline dot */}
                <div
                  className={`absolute left-3.5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${meta.dot}`}
                  aria-hidden="true"
                />

                <div className={`rounded-lg p-4 ${meta.bg}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ActionIcon
                        className={`w-4 h-4 shrink-0 ${meta.text}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`text-sm font-semibold ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 mt-2">
                    {comment.comment}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {comment.createdByName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(comment.createdAt)}
                    </span>
                    {comment.attachmentUrl && (
                      <a
                        href={comment.attachmentUrl}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Attachment
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default ApprovalCommentHistory;