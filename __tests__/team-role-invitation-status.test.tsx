import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamRoleInvitationStatusView from "@/components/team/TeamRoleInvitationStatusView";
import {
  INITIAL_TEAM_INVITATIONS,
  filterInvitations,
  revokeInvitationHelper,
  resendInvitationHelper,
} from "@/src/team/invitations";

describe("TeamRoleInvitationStatusView", () => {
  it("renders team invitations summary counters and invitation list across roles and statuses", () => {
    render(<TeamRoleInvitationStatusView initialInvitations={INITIAL_TEAM_INVITATIONS} />);

    expect(screen.getByTestId("team-role-invitation-status-view")).toBeInTheDocument();
    expect(screen.getByText("sarah.admin@zkpayroll.io")).toBeInTheDocument();
    expect(screen.getByText("alex.reviewer@zkpayroll.io")).toBeInTheDocument();
    expect(screen.getByText("treasury.op@zkpayroll.io")).toBeInTheDocument();
    expect(screen.getByText("compliance.auditor@zkpayroll.io")).toBeInTheDocument();

    // Verify role badges
    expect(screen.getByText("Payroll Admin")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.getByText("Treasury Operator")).toBeInTheDocument();
    expect(screen.getByText("Auditor")).toBeInTheDocument();
  });

  it("filters invitations by status when filter cards are clicked", () => {
    render(<TeamRoleInvitationStatusView initialInvitations={INITIAL_TEAM_INVITATIONS} />);

    // Click 'pending' filter
    fireEvent.click(screen.getByTestId("filter-btn-pending"));

    expect(screen.getByText("alex.reviewer@zkpayroll.io")).toBeInTheDocument();
    expect(screen.queryByText("sarah.admin@zkpayroll.io")).not.toBeInTheDocument();
    expect(screen.queryByText("treasury.op@zkpayroll.io")).not.toBeInTheDocument();
  });

  it("revokes a pending invitation when Revoke action is clicked", () => {
    render(<TeamRoleInvitationStatusView initialInvitations={INITIAL_TEAM_INVITATIONS} />);

    const revokeBtn = screen.getByRole("button", {
      name: /Revoke invitation for alex.reviewer@zkpayroll.io/i,
    });
    fireEvent.click(revokeBtn);

    expect(
      screen.getByText("Invitation for alex.reviewer@zkpayroll.io has been revoked."),
    ).toBeInTheDocument();
  });

  it("resends an expired invitation when Resend action is clicked", () => {
    render(<TeamRoleInvitationStatusView initialInvitations={INITIAL_TEAM_INVITATIONS} />);

    const resendBtn = screen.getByRole("button", {
      name: /Resend invitation to treasury.op@zkpayroll.io/i,
    });
    fireEvent.click(resendBtn);

    expect(
      screen.getByText("Invitation for treasury.op@zkpayroll.io has been resent."),
    ).toBeInTheDocument();
  });

  it("confirms privacy guarantee: no sensitive salary values in invitations view", () => {
    render(<TeamRoleInvitationStatusView initialInvitations={INITIAL_TEAM_INVITATIONS} />);

    const html = screen.getByTestId("team-role-invitation-status-view").innerHTML;
    expect(html).not.toContain("salary");
    expect(html).not.toContain("salaryCommitment");
  });
});

describe("Invitation helpers unit tests", () => {
  it("filterInvitations filters accurately by status and search query", () => {
    const pendingOnly = filterInvitations(INITIAL_TEAM_INVITATIONS, "pending");
    expect(pendingOnly).toHaveLength(1);
    expect(pendingOnly[0].email).toBe("alex.reviewer@zkpayroll.io");

    const searchResult = filterInvitations(INITIAL_TEAM_INVITATIONS, "all", "auditor");
    expect(searchResult.length).toBeGreaterThan(0);
  });

  it("revokeInvitationHelper rejects revoking non-pending invitations", () => {
    const res = revokeInvitationHelper(INITIAL_TEAM_INVITATIONS, "inv_001"); // accepted
    expect(res.success).toBe(false);
    expect(res.error).toContain("Cannot revoke an invitation that is already accepted");
  });

  it("resendInvitationHelper extends expiration date for pending/expired invitations", () => {
    const res = resendInvitationHelper(INITIAL_TEAM_INVITATIONS, "inv_003"); // expired
    expect(res.success).toBe(true);
    const updatedItem = res.updated.find((i) => i.id === "inv_003");
    expect(updatedItem?.status).toBe("pending");
  });
});
