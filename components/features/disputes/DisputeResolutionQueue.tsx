"use client";

import { useState, useMemo } from "react";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Ban,
  ShieldAlert,
  UserCheck,
  Filter,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useDisputesStore, DISPUTE_STATUS_LABELS } from "@/stores/disputes";
import { useSession } from "@/hooks/useSession";
import { StatusBadge } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import type { PayrollDispute, DisputeStatus, UserRole, DisputeBlockedAction } from "@/types";
import { toast } from "sonner";

type FilterValue = "all" | "active" | "overdue" | "resolved" | "blocked_finalization";

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All Disputes" },
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "resolved", label: "Resolved" },
  { value: "blocked_finalization", label: "Blocked Finalization" },
];

const BLOCKED_ACTION_LABELS: Record<DisputeBlockedAction, string> = {
  finalization: "Finalization",
  approval: "Executive Approval",
  execution: "Execution",
  reconciliation: "Reconciliation",
  audit_export: "Audit Export",
};

const BLOCKED_ACTION_DESCRIPTIONS: Record<DisputeBlockedAction, string> = {
  finalization: "The payroll batch cannot be finalized until this dispute is resolved.",
  approval: "The payroll batch cannot receive executive approval until this dispute is resolved.",
  execution: "The payroll batch cannot be executed on-chain until this dispute is resolved.",
  reconciliation: "Reconciliation is blocked for this payroll batch.",
  audit_export: "Audit export is blocked for this payroll batch.",
};

const STATUS_ICON_MAP: Record<DisputeStatus, React.ComponentType<{ className?: string }>> = {
  active: Clock,
  overdue: AlertTriangle,
  resolved: CheckCircle2,
  escalated: ArrowUpRight,
};

const STATUS_STYLE_MAP: Record<DisputeStatus, string> = {
  active: "text-amber-600",
  overdue: "text-red-600",
  resolved: "text-green-600",
  escalated: "text-orange-600",
};

const REASON_CODE_DISPLAY: Record<string, string> = {
  insufficient_treasury: "Insufficient Treasury",
  pending_approval: "Pending Approval",
  zk_proof_failed: "ZK Proof Failed",
  employee_data_changed: "Employee Data Changed",
  network_error: "Network Error",
  manual_freeze: "Manual Freeze",
  compliance_hold: "Compliance Hold",
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  operator: "Operator",
  auditor: "Auditor",
};

function canResolveRole(currentRole: UserRole, requiredRole: UserRole): boolean {
  if (currentRole === "admin") return true;
  if (currentRole === "operator" && requiredRole === "operator") return true;
  return false;
}

function isOverdue(deadline: string): boolean {
  return new Date(deadline) < new Date();
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DisputeCard({
  dispute,
  currentUserRole,
  onResolve,
  onEscalate,
}: {
  dispute: PayrollDispute;
  currentUserRole: UserRole;
  onResolve: (dispute: PayrollDispute) => void;
  onEscalate: (dispute: PayrollDispute) => void;
}) {
  const Icon = STATUS_ICON_MAP[dispute.status] ?? AlertCircle;
  const iconColor = STATUS_STYLE_MAP[dispute.status] ?? "text-gray-600";
  const canAct = dispute.status !== "resolved" && canResolveRole(currentUserRole, dispute.requiredReviewer);

  return (
    <li
      className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4"
      role="article"
      aria-label={`Dispute for ${dispute.payrollPeriod}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900">
                {dispute.payrollPeriod}
              </h3>
              <StatusBadge status={dispute.status} />
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Batch: <span className="font-medium text-gray-700">{dispute.payrollBatch}</span>
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">Deadline</p>
          <p className={`text-xs font-medium ${isOverdue(dispute.resolutionDeadline) && dispute.status !== "resolved" ? "text-red-600" : "text-gray-700"}`}>
            {formatDeadline(dispute.resolutionDeadline)}
          </p>
        </div>
      </div>

      <div className="rounded-md bg-gray-50 p-3 text-xs space-y-2">
        <div>
          <span className="font-semibold text-gray-700">Reason: </span>
          <span className="text-gray-600">
            {REASON_CODE_DISPLAY[dispute.safeReasonCode] ?? dispute.safeReasonCode}
          </span>
          <span className="text-gray-400"> — </span>
          <span className="text-gray-600">{dispute.safeReasonDescription}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-700">Required Reviewer: </span>
          <span className="text-gray-600">{ROLE_LABELS[dispute.requiredReviewer]}</span>
        </div>
      </div>

      {dispute.blockedActions.length > 0 && (
        <div className="rounded-md bg-red-50 border border-red-100 p-3" role="alert" aria-label="Blocked lifecycle actions">
          <div className="flex items-start gap-2 mb-2">
            <Ban className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-red-800">
                Blocked Lifecycle Actions ({dispute.blockedActions.length})
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                These actions cannot proceed until this dispute is resolved:
              </p>
            </div>
          </div>
          <ul className="ml-6 space-y-1">
            {dispute.blockedActions.map((action) => (
              <li key={action} className="text-xs text-red-700">
                <span className="font-medium">{BLOCKED_ACTION_LABELS[action]}: </span>
                {BLOCKED_ACTION_DESCRIPTIONS[action]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dispute.status === "resolved" && dispute.resolutionNote && (
        <div className="rounded-md bg-green-50 border border-green-100 p-3">
          <p className="text-xs font-semibold text-green-800 mb-1">Resolution Note</p>
          <p className="text-xs text-green-700">{dispute.resolutionNote}</p>
          {dispute.resolvedBy && (
            <p className="text-xs text-green-600 mt-1">
              Resolved by {dispute.resolvedBy} on {dispute.resolvedAt ? formatDeadline(dispute.resolvedAt) : "—"}
            </p>
          )}
        </div>
      )}

      {dispute.status === "escalated" && dispute.resolutionNote && (
        <div className="rounded-md bg-orange-50 border border-orange-100 p-3">
          <p className="text-xs font-semibold text-orange-800 mb-1">Escalation Note</p>
          <p className="text-xs text-orange-700">{dispute.resolutionNote}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        <div className="text-xs text-gray-500 mr-auto flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Next: {dispute.resolutionAction}</span>
        </div>
        {canAct && dispute.status !== "resolved" && (
          <>
            <button
              type="button"
              onClick={() => onResolve(dispute)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              aria-label={`Resolve dispute for ${dispute.payrollPeriod}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Resolve
            </button>
            <button
              type="button"
              onClick={() => onEscalate(dispute)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-orange-100 text-orange-700 text-xs font-semibold hover:bg-orange-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              aria-label={`Escalate dispute for ${dispute.payrollPeriod}`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              Escalate
            </button>
          </>
        )}
        {!canAct && dispute.status !== "resolved" && (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-gray-100 text-gray-500 text-xs font-medium cursor-not-allowed" aria-label="Insufficient permissions to take action">
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
            Requires {ROLE_LABELS[dispute.requiredReviewer]} role
          </span>
        )}
      </div>
    </li>
  );
}

export default function DisputeResolutionQueue() {
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const { disputes, isLoading, error, resolveDispute, escalateDispute } = useDisputesStore();
  const { sessionInfo } = useSession();
  const currentUserRole: UserRole = sessionInfo?.role ?? "auditor";

  const [resolveDialog, setResolveDialog] = useState<PayrollDispute | null>(null);
  const [escalateDialog, setEscalateDialog] = useState<PayrollDispute | null>(null);

  const filteredDisputes = useMemo(() => {
    switch (activeFilter) {
      case "active":
        return disputes.filter((d) => d.status === "active");
      case "overdue":
        return disputes.filter((d) => d.status === "overdue");
      case "resolved":
        return disputes.filter((d) => d.status === "resolved");
      case "blocked_finalization":
        return disputes.filter((d) => d.blockedActions.includes("finalization"));
      default:
        return disputes;
    }
  }, [disputes, activeFilter]);

  const counts = useMemo(() => ({
    all: disputes.length,
    active: disputes.filter((d) => d.status === "active").length,
    overdue: disputes.filter((d) => d.status === "overdue").length,
    resolved: disputes.filter((d) => d.status === "resolved").length,
    blocked_finalization: disputes.filter((d) => d.blockedActions.includes("finalization")).length,
  }), [disputes]);

  const handleResolve = async () => {
    if (!resolveDialog || !sessionInfo) return;
    resolveDispute(resolveDialog.id, sessionInfo.publicKey, sessionInfo.role);
    toast.success(`Dispute resolved for ${resolveDialog.payrollPeriod}`);
    setResolveDialog(null);
  };

  const handleEscalate = async () => {
    if (!escalateDialog || !sessionInfo) return;
    escalateDispute(escalateDialog.id, sessionInfo.publicKey, sessionInfo.role);
    toast.success(`Dispute escalated for ${escalateDialog.payrollPeriod}`);
    setEscalateDialog(null);
  };

  if (isLoading) {
    return (
      <section aria-labelledby="disputes-heading" className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center py-12" role="status" aria-label="Loading disputes">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" aria-hidden="true" />
          <span className="ml-2 text-sm text-gray-500">Loading disputes...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-labelledby="disputes-heading" className="rounded-lg bg-white p-6 shadow-sm">
        <div className="rounded-md bg-red-50 border border-red-200 p-4" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-red-800">Failed to load disputes</h2>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="disputes-heading" className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-4 gap-4">
        <div>
          <h2 id="disputes-heading" className="text-base font-semibold text-gray-900">
            Dispute Resolution Queue
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Review and resolve blocked payroll disputes
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Filter className="w-4 h-4" aria-hidden="true" />
          <span className="font-medium">Filter:</span>
        </div>
      </div>

      <nav aria-label="Dispute filters" className="mb-4">
        <div
          role="tablist"
          aria-label="Filter disputes by status"
          className="flex flex-wrap gap-1 bg-gray-100 p-0.5 rounded-lg text-xs font-medium"
        >
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={activeFilter === option.value}
              aria-controls="dispute-list-panel"
              id={`filter-tab-${option.value}`}
              onClick={() => setActiveFilter(option.value)}
              className={`px-3 py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                activeFilter === option.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {option.label} ({counts[option.value]})
            </button>
          ))}
        </div>
      </nav>

      {filteredDisputes.length === 0 ? (
        <div
          id="dispute-list-panel"
          role="tabpanel"
          aria-labelledby={`filter-tab-${activeFilter}`}
        >
          <EmptyState
            icon={CheckCircle2}
            title={
              activeFilter === "all"
                ? "No disputes"
                : `No ${activeFilter.replace("_", " ")} disputes`
            }
            description={
              activeFilter === "all"
                ? "All payroll batches are proceeding without disputes."
                : "No disputes match the current filter."
            }
          />
        </div>
      ) : (
        <ul
          id="dispute-list-panel"
          role="tabpanel"
          aria-labelledby={`filter-tab-${activeFilter}`}
          className="space-y-3"
          aria-label={`${activeFilter === "all" ? "All" : activeFilter.replace("_", " ")} disputes`}
        >
          {filteredDisputes.map((dispute) => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              currentUserRole={currentUserRole}
              onResolve={setResolveDialog}
              onEscalate={setEscalateDialog}
            />
          ))}
        </ul>
      )}

      <ConfirmationDialog
        isOpen={resolveDialog !== null}
        title="Resolve Dispute"
        description={`Resolve the dispute for payroll period ${resolveDialog?.payrollPeriod ?? ""}? This will unblock all associated lifecycle actions.`}
        confirmText="Resolve Dispute"
        variant="info"
        icon="shield"
        showReasonField
        reasonLabel="Resolution note"
        reasonPlaceholder="Describe how this dispute was resolved..."
        onConfirm={handleResolve}
        onCancel={() => setResolveDialog(null)}
      />

      <ConfirmationDialog
        isOpen={escalateDialog !== null}
        title="Escalate Dispute"
        description={`Escalate the dispute for payroll period ${escalateDialog?.payrollPeriod ?? ""}? This will flag it for senior review.`}
        confirmText="Escalate Dispute"
        variant="warning"
        icon="alert"
        showReasonField
        reasonLabel="Escalation reason"
        reasonPlaceholder="Describe why this dispute needs escalation..."
        onConfirm={handleEscalate}
        onCancel={() => setEscalateDialog(null)}
      />
    </section>
  );
}
