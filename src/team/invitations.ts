export type TeamRole = "payroll_admin" | "reviewer" | "treasury_operator" | "auditor";

export type TeamInvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface TeamInvitation {
  id: string;
  email: string;
  role: TeamRole;
  status: TeamInvitationStatus;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
}

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  payroll_admin: "Payroll Admin",
  reviewer: "Reviewer",
  treasury_operator: "Treasury Operator",
  auditor: "Auditor",
};

export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  payroll_admin: "Full administration and employee lifecycle authority",
  reviewer: "Reviews payroll drafts and signs approval quorums",
  treasury_operator: "Manages funding reserves and disbursement execution",
  auditor: "Read-only access to audit logs, compliance evidence, and reports",
};

export const INITIAL_TEAM_INVITATIONS: TeamInvitation[] = [
  {
    id: "inv_001",
    email: "sarah.admin@zkpayroll.io",
    role: "payroll_admin",
    status: "accepted",
    invitedBy: "owner@zkpayroll.io",
    createdAt: "2025-01-10T10:00:00Z",
    expiresAt: "2025-01-17T10:00:00Z",
    acceptedAt: "2025-01-11T14:30:00Z",
  },
  {
    id: "inv_002",
    email: "alex.reviewer@zkpayroll.io",
    role: "reviewer",
    status: "pending",
    invitedBy: "owner@zkpayroll.io",
    createdAt: "2025-01-20T09:00:00Z",
    expiresAt: "2025-01-27T09:00:00Z",
  },
  {
    id: "inv_003",
    email: "treasury.op@zkpayroll.io",
    role: "treasury_operator",
    status: "expired",
    invitedBy: "owner@zkpayroll.io",
    createdAt: "2025-01-01T08:00:00Z",
    expiresAt: "2025-01-08T08:00:00Z",
  },
  {
    id: "inv_004",
    email: "compliance.auditor@zkpayroll.io",
    role: "auditor",
    status: "revoked",
    invitedBy: "owner@zkpayroll.io",
    createdAt: "2025-01-05T11:00:00Z",
    expiresAt: "2025-01-12T11:00:00Z",
    revokedAt: "2025-01-06T15:00:00Z",
  },
];

export function filterInvitations(
  invitations: TeamInvitation[],
  statusFilter: "all" | TeamInvitationStatus = "all",
  searchQuery: string = "",
): TeamInvitation[] {
  let result = invitations;
  if (statusFilter !== "all") {
    result = result.filter((inv) => inv.status === statusFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (inv) =>
        inv.email.toLowerCase().includes(q) ||
        TEAM_ROLE_LABELS[inv.role].toLowerCase().includes(q) ||
        inv.invitedBy.toLowerCase().includes(q),
    );
  }
  return result;
}

export function revokeInvitationHelper(
  invitations: TeamInvitation[],
  id: string,
): { updated: TeamInvitation[]; success: boolean; error?: string } {
  const target = invitations.find((inv) => inv.id === id);
  if (!target) {
    return { updated: invitations, success: false, error: "Invitation not found." };
  }
  if (target.status !== "pending") {
    return {
      updated: invitations,
      success: false,
      error: `Cannot revoke an invitation that is already ${target.status}.`,
    };
  }

  const updated = invitations.map((inv) =>
    inv.id === id
      ? { ...inv, status: "revoked" as const, revokedAt: new Date().toISOString() }
      : inv,
  );
  return { updated, success: true };
}

export function resendInvitationHelper(
  invitations: TeamInvitation[],
  id: string,
): { updated: TeamInvitation[]; success: boolean; error?: string } {
  const target = invitations.find((inv) => inv.id === id);
  if (!target) {
    return { updated: invitations, success: false, error: "Invitation not found." };
  }
  if (target.status === "accepted" || target.status === "revoked") {
    return {
      updated: invitations,
      success: false,
      error: `Cannot resend an invitation that is ${target.status}.`,
    };
  }

  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const updated = invitations.map((inv) =>
    inv.id === id
      ? { ...inv, status: "pending" as const, expiresAt: newExpiry }
      : inv,
  );
  return { updated, success: true };
}
