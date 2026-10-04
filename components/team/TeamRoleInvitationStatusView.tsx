"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Users,
  Mail,
  UserCheck,
  Clock,
  UserX,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Plus,
} from "lucide-react";
import {
  TeamInvitation,
  TeamInvitationStatus,
  TeamRole,
  TEAM_ROLE_LABELS,
  TEAM_ROLE_DESCRIPTIONS,
  INITIAL_TEAM_INVITATIONS,
  filterInvitations,
  revokeInvitationHelper,
  resendInvitationHelper,
} from "@/src/team/invitations";

export interface TeamRoleInvitationStatusViewProps {
  initialInvitations?: TeamInvitation[];
}

const STATUS_BADGES: Record<
  TeamInvitationStatus,
  { label: string; bg: string; text: string; icon: typeof UserCheck }
> = {
  pending: {
    label: "Pending",
    bg: "bg-amber-100",
    text: "text-amber-800",
    icon: Clock,
  },
  accepted: {
    label: "Accepted",
    bg: "bg-green-100",
    text: "text-green-800",
    icon: UserCheck,
  },
  expired: {
    label: "Expired",
    bg: "bg-gray-100",
    text: "text-gray-700",
    icon: Clock,
  },
  revoked: {
    label: "Revoked",
    bg: "bg-red-100",
    text: "text-red-800",
    icon: UserX,
  },
};

const ROLE_BADGES: Record<TeamRole, string> = {
  payroll_admin: "bg-indigo-100 text-indigo-800 border-indigo-200",
  reviewer: "bg-blue-100 text-blue-800 border-blue-200",
  treasury_operator: "bg-emerald-100 text-emerald-800 border-emerald-200",
  auditor: "bg-purple-100 text-purple-800 border-purple-200",
};

export function TeamRoleInvitationStatusView({
  initialInvitations = INITIAL_TEAM_INVITATIONS,
}: TeamRoleInvitationStatusViewProps) {
  const [invitations, setInvitations] = useState<TeamInvitation[]>(initialInvitations);
  const [statusFilter, setStatusFilter] = useState<"all" | TeamInvitationStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // New invitation form modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("reviewer");

  const filtered = useMemo(
    () => filterInvitations(invitations, statusFilter, searchQuery),
    [invitations, statusFilter, searchQuery],
  );

  const counts = useMemo(() => {
    const result: Record<"all" | TeamInvitationStatus, number> = {
      all: invitations.length,
      pending: 0,
      accepted: 0,
      expired: 0,
      revoked: 0,
    };
    for (const inv of invitations) {
      result[inv.status]++;
    }
    return result;
  }, [invitations]);

  const handleRevoke = useCallback((id: string, email: string) => {
    setFeedback(null);
    const res = revokeInvitationHelper(invitations, id);
    if (res.success) {
      setInvitations(res.updated);
      setFeedback({ type: "success", message: `Invitation for ${email} has been revoked.` });
    } else {
      setFeedback({ type: "error", message: res.error || "Failed to revoke invitation." });
    }
  }, [invitations]);

  const handleResend = useCallback((id: string, email: string) => {
    setFeedback(null);
    const res = resendInvitationHelper(invitations, id);
    if (res.success) {
      setInvitations(res.updated);
      setFeedback({ type: "success", message: `Invitation for ${email} has been resent.` });
    } else {
      setFeedback({ type: "error", message: res.error || "Failed to resend invitation." });
    }
  }, [invitations]);

  const handleCreateInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const newInv: TeamInvitation = {
      id: `inv_${Date.now()}`,
      email: newEmail.trim(),
      role: newRole,
      status: "pending",
      invitedBy: "admin@zkpayroll.io",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    setInvitations([newInv, ...invitations]);
    setFeedback({
      type: "success",
      message: `Invitation sent to ${newEmail} as ${TEAM_ROLE_LABELS[newRole]}.`,
    });
    setNewEmail("");
    setShowInviteModal(false);
  };

  return (
    <section
      aria-labelledby="team-invitations-heading"
      className="space-y-6"
      data-testid="team-role-invitation-status-view"
    >
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" aria-hidden="true" />
              <h2 id="team-invitations-heading" className="text-xl font-bold text-gray-900">
                Team Role Invitations
              </h2>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Track pending, accepted, expired, and revoked role onboarding invitations for payroll admins, reviewers, treasury operators, and auditors.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors self-start sm:self-auto shadow-sm"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Invite Team Member
          </button>
        </div>

        {/* Status Filter Cards */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(["all", "pending", "accepted", "expired", "revoked"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`p-3 rounded-lg border text-left transition-all ${
                statusFilter === s
                  ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
              data-testid={`filter-btn-${s}`}
            >
              <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                {s === "all" ? "Total" : s}
              </div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">{counts[s]}</div>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by email, role, or inviter…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Search invitations"
          />
        </div>
      </div>

      {/* Feedback Messages */}
      {feedback && (
        <div
          className={`rounded-lg border p-4 text-sm flex items-center gap-2 ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="status"
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Invitations Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No team role invitations match the selected criteria.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Team role invitation status table</caption>
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
              <tr>
                <th scope="col" className="px-6 py-3">Recipient Email</th>
                <th scope="col" className="px-6 py-3">Role</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Invited By</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((inv) => {
                const statusBadge = STATUS_BADGES[inv.status];
                const StatusIcon = statusBadge.icon;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors" data-testid={`invitation-row-${inv.id}`}>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
                        <span>{inv.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ROLE_BADGES[inv.role]}`}>
                        {TEAM_ROLE_LABELS[inv.role]}
                      </span>
                      <p className="text-[11px] text-gray-500 mt-0.5">{TEAM_ROLE_DESCRIPTIONS[inv.role]}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
                        <StatusIcon className="w-3 h-3" aria-hidden="true" />
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      <div>{inv.invitedBy}</div>
                      <div className="text-[11px] text-gray-400">Created: {new Date(inv.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {inv.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRevoke(inv.id, inv.email)}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
                              aria-label={`Revoke invitation for ${inv.email}`}
                            >
                              Revoke
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResend(inv.id, inv.email)}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                              aria-label={`Resend invitation to ${inv.email}`}
                            >
                              Resend
                            </button>
                          </>
                        )}
                        {inv.status === "expired" && (
                          <button
                            type="button"
                            onClick={() => handleResend(inv.id, inv.email)}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                            aria-label={`Resend invitation to ${inv.email}`}
                          >
                            Resend
                          </button>
                        )}
                        {(inv.status === "accepted" || inv.status === "revoked") && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-labelledby="invite-modal-title"
          data-testid="invite-team-member-modal"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 id="invite-modal-title" className="text-lg font-bold text-gray-900">
              Invite Team Member
            </h3>
            <form onSubmit={handleCreateInvitation} className="space-y-4">
              <div>
                <label htmlFor="invite-email" className="block text-xs font-semibold text-gray-700 mb-1">
                  Recipient Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="colleague@organization.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="block text-xs font-semibold text-gray-700 mb-1">
                  Assigned Team Role
                </label>
                <select
                  id="invite-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as TeamRole)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="payroll_admin">Payroll Admin</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="treasury_operator">Treasury Operator</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default TeamRoleInvitationStatusView;
