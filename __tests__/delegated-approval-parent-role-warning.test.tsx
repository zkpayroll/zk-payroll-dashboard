/**
 * Tests for the parent-role expiry warning surfaced in the delegation
 * panels (#778): a temporary delegation and a standing delegated approver
 * whose parent role lapses first must warn visibly; one whose parent
 * outlives it must not.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TemporaryApproverDelegationPanel from "@/components/features/approvals/TemporaryApproverDelegationPanel";
import DelegatedApproverPanel from "@/components/features/approvals/DelegatedApproverPanel";
import { useDelegatedApproversStore } from "@/stores/delegatedApprovers";
import type { TemporaryDelegation, DelegatedApprover } from "@/stores/delegatedApprovers";

const NOW = new Date("2026-09-20T10:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

const ADDRESS = "GAYN325M3W4R3J2J53X2Z3Q4W5E6R7T8Y9U0I1O2P3A4S5D6F7G8H9J0";

function makeDelegation(
  overrides: Partial<TemporaryDelegation> & { id: string },
): TemporaryDelegation {
  return {
    address: ADDRESS,
    label: "Acting Finance Lead",
    startsAt: iso(-HOUR),
    expiresAt: iso(24 * HOUR),
    createdAt: iso(-HOUR),
    createdBy: "Executive Admin",
    ...overrides,
  };
}

function makeApprover(
  overrides: Partial<DelegatedApprover> & { id: string },
): DelegatedApprover {
  return {
    address: ADDRESS,
    label: "Treasury Delegate",
    addedAt: iso(0),
    addedBy: "Executive Admin",
    ...overrides,
  };
}

describe("parent-role expiry warning (#778)", () => {
  beforeEach(() => {
    useDelegatedApproversStore.setState({
      approvers: [],
      temporaryDelegations: [],
    });
  });

  it("warns on a temporary delegation that expires with its parent role", () => {
    const delegation = makeDelegation({
      id: "temp_parent_early",
      parentRole: { roleLabel: "Admin", expiresAt: iso(2 * HOUR) },
    });

    render(
      <TemporaryApproverDelegationPanel
        delegations={[delegation]}
        now={NOW}
      />,
    );

    expect(
      screen.getByTestId("parent-role-warning-temp_parent_early"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("parent-role-expiry-banner"),
    ).toBeInTheDocument();
    // The warning text appears both in the summary banner and on the row.
    expect(
      screen.getAllByText(/expires with its parent role/).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByTestId("parent-role-warning-temp_parent_early"),
    ).toHaveTextContent(/expires with its parent role/);
  });

  it("shows an expired warning when the parent role was revoked", () => {
    const delegation = makeDelegation({
      id: "temp_parent_revoked",
      parentRole: {
        roleLabel: "Admin",
        expiresAt: iso(48 * HOUR),
        revoked: true,
        revokedAt: iso(-30 * 60 * 1000),
      },
    });

    render(
      <TemporaryApproverDelegationPanel
        delegations={[delegation]}
        now={NOW}
      />,
    );

    expect(
      screen.getByTestId("parent-role-warning-temp_parent_revoked"),
    ).toBeInTheDocument();
    expect(screen.getByText(/was revoked/)).toBeInTheDocument();
  });

  it("shows no warning when the parent role outlives the delegation", () => {
    const delegation = makeDelegation({
      id: "temp_parent_late",
      parentRole: { roleLabel: "Admin", expiresAt: iso(48 * HOUR) },
    });

    render(
      <TemporaryApproverDelegationPanel
        delegations={[delegation]}
        now={NOW}
      />,
    );

    expect(
      screen.queryByTestId("parent-role-warning-temp_parent_late"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("parent-role-expiry-banner"),
    ).not.toBeInTheDocument();
  });

  it("shows no warning when no parent role is recorded", () => {
    render(
      <TemporaryApproverDelegationPanel
        delegations={[makeDelegation({ id: "temp_no_parent" })]}
        now={NOW}
      />,
    );

    expect(
      screen.queryByTestId("parent-role-warning-temp_no_parent"),
    ).not.toBeInTheDocument();
  });

  it("warns on a standing approver whose parent role lapses first", () => {
    // The standing panel reads the live clock, so anchor its window on now.
    const addedAt = new Date(Date.now()).toISOString();
    const approver = makeApprover({
      id: "del_parent_early",
      addedAt,
      parentRole: {
        roleLabel: "Admin",
        expiresAt: new Date(Date.now() + 2 * HOUR).toISOString(),
      },
    });

    render(<DelegatedApproverPanel approvers={[approver]} />);

    expect(
      screen.getByTestId("parent-role-warning-del_parent_early"),
    ).toBeInTheDocument();
    expect(screen.getByText(/expires with its parent role/)).toBeInTheDocument();
  });
});
