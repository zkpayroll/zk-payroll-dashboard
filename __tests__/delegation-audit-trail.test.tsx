import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import DelegationAuditTrailPanel from "@/components/features/approvals/DelegationAuditTrailPanel";
import {
  buildDelegationAuditTrail,
  delegationAuditEventLabel,
  filterDelegationAuditTrailByAddress,
} from "@/lib/payroll/delegationAudit";
import {
  useDelegatedApproversStore,
  type DelegatedApprover,
  type TemporaryDelegation,
} from "@/stores/delegatedApprovers";

// Payroll responsibility delegation audit (#681): a chronological trail of
// who was granted or revoked payroll approval authority, derived purely from
// existing delegation state (never its own persisted log).

const ADDRESS_A = "GAYN325M3W4R3J2J53X2Z3Q4W5E6R7T8Y9U0I1O2P3A4S5D6F7G8H9J0";
const ADDRESS_B = "GB7N6543210987654321098765432109876543210987654321098765";

function approver(over: Partial<DelegatedApprover> = {}): DelegatedApprover {
  return {
    id: "del_app_001",
    address: ADDRESS_A,
    label: "Treasury Delegate",
    addedAt: "2026-07-20T10:00:00Z",
    addedBy: "Executive Admin",
    companyId: "company_001",
    ...over,
  };
}

function delegation(over: Partial<TemporaryDelegation> = {}): TemporaryDelegation {
  return {
    id: "temp_del_001",
    address: ADDRESS_B,
    label: "Acting Finance Lead",
    startsAt: "2026-08-01T00:00:00Z",
    expiresAt: "2026-08-03T00:00:00Z",
    createdAt: "2026-07-31T09:00:00Z",
    createdBy: "Compliance Lead",
    companyId: "company_001",
    ...over,
  };
}

describe("buildDelegationAuditTrail", () => {
  it("produces an added event for each standing approver (success path)", () => {
    const events = buildDelegationAuditTrail([approver()], []);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("approver_added");
    expect(events[0].actor).toBe("Executive Admin");
    expect(events[0].summary).toContain("Treasury Delegate");
    expect(events[0].summary).toContain("Executive Admin");
  });

  it("produces a scheduled event for a temporary delegation that hasn't lapsed", () => {
    const now = new Date("2026-08-02T00:00:00Z").getTime();
    const events = buildDelegationAuditTrail([], [delegation()], now);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("temporary_delegation_scheduled");
    expect(events[0].actor).toBe("Compliance Lead");
  });

  it("adds a revoked event when a temporary delegation was manually revoked (edge case)", () => {
    const now = new Date("2026-08-02T00:00:00Z").getTime();
    const revoked = delegation({ revokedAt: "2026-08-01T12:00:00Z" });
    const events = buildDelegationAuditTrail([], [revoked], now);

    expect(events).toHaveLength(2);
    const types = events.map((e) => e.type);
    expect(types).toContain("temporary_delegation_scheduled");
    expect(types).toContain("temporary_delegation_revoked");
    // Revoked (later) should sort before scheduled (earlier) — newest first.
    expect(events[0].type).toBe("temporary_delegation_revoked");
  });

  it("adds an expired event once the window has lapsed without manual revocation (edge case)", () => {
    const now = new Date("2026-08-10T00:00:00Z").getTime(); // well after expiresAt
    const events = buildDelegationAuditTrail([], [delegation()], now);

    const types = events.map((e) => e.type);
    expect(types).toContain("temporary_delegation_expired");
    expect(types).not.toContain("temporary_delegation_revoked");
  });

  it("does not report expiry for a delegation that is still within its window (failure-to-overreport check)", () => {
    const now = new Date("2026-08-02T00:00:00Z").getTime(); // inside window
    const events = buildDelegationAuditTrail([], [delegation()], now);
    expect(events.map((e) => e.type)).not.toContain("temporary_delegation_expired");
  });

  it("sorts mixed events newest-first across approvers and delegations", () => {
    const now = new Date("2026-08-02T00:00:00Z").getTime();
    const events = buildDelegationAuditTrail(
      [approver({ addedAt: "2026-07-01T00:00:00Z" })],
      [delegation({ createdAt: "2026-07-31T09:00:00Z" })],
      now,
    );
    expect(events[0].occurredAt >= events[1].occurredAt).toBe(true);
  });

  it("returns no events when there is no delegation activity at all (empty-state path)", () => {
    expect(buildDelegationAuditTrail([], [])).toEqual([]);
  });
});

describe("filterDelegationAuditTrailByAddress", () => {
  it("filters case-insensitively to one address", () => {
    const events = buildDelegationAuditTrail([approver()], [delegation()]);
    const filtered = filterDelegationAuditTrailByAddress(events, ADDRESS_A.toLowerCase());
    expect(filtered).toHaveLength(1);
    expect(filtered[0].address).toBe(ADDRESS_A);
  });

  it("returns every event when the filter is empty (no-op path)", () => {
    const events = buildDelegationAuditTrail([approver()], [delegation()]);
    expect(filterDelegationAuditTrailByAddress(events, "")).toEqual(events);
  });

  it("returns an empty list when nothing matches (failure path)", () => {
    const events = buildDelegationAuditTrail([approver()], []);
    expect(filterDelegationAuditTrailByAddress(events, "GUNKNOWN")).toEqual([]);
  });
});

describe("delegationAuditEventLabel", () => {
  it("has a human label for every event type", () => {
    expect(delegationAuditEventLabel("approver_added")).toMatch(/added/i);
    expect(delegationAuditEventLabel("temporary_delegation_scheduled")).toMatch(/scheduled/i);
    expect(delegationAuditEventLabel("temporary_delegation_revoked")).toMatch(/revoked/i);
    expect(delegationAuditEventLabel("temporary_delegation_expired")).toMatch(/expired/i);
  });
});

describe("DelegationAuditTrailPanel", () => {
  beforeEach(() => {
    useDelegatedApproversStore.setState({
      approvers: [approver()],
      temporaryDelegations: [delegation()],
    });
  });

  it("renders the derived audit events from store state (success path)", () => {
    render(<DelegationAuditTrailPanel now={new Date("2026-08-02T00:00:00Z").getTime()} />);
    expect(screen.getByText("Delegation Responsibility Audit")).toBeInTheDocument();
    expect(screen.getByTestId("delegation-audit-trail-list")).toBeInTheDocument();
    expect(screen.getAllByText(/Treasury Delegate|Acting Finance Lead/).length).toBeGreaterThan(0);
  });

  it("shows an empty state when there is no delegation activity (empty-state path)", () => {
    useDelegatedApproversStore.setState({ approvers: [], temporaryDelegations: [] });
    render(<DelegationAuditTrailPanel />);
    expect(screen.getByText(/No delegation activity recorded yet/)).toBeInTheDocument();
  });

  it("filters the rendered list by address (interaction path)", () => {
    render(<DelegationAuditTrailPanel now={new Date("2026-08-02T00:00:00Z").getTime()} />);
    const input = screen.getByLabelText(/Filter delegation audit trail/i);
    fireEvent.change(input, { target: { value: ADDRESS_B } });
    expect(screen.queryByText(/Treasury Delegate/)).not.toBeInTheDocument();
    expect(screen.getByText(/Acting Finance Lead/)).toBeInTheDocument();
  });

  it("shows a no-match empty state when the filter matches nothing (failure path)", () => {
    render(<DelegationAuditTrailPanel now={new Date("2026-08-02T00:00:00Z").getTime()} />);
    const input = screen.getByLabelText(/Filter delegation audit trail/i);
    fireEvent.change(input, { target: { value: "GNOMATCH" } });
    expect(screen.getByText(/No delegation activity matches this address/)).toBeInTheDocument();
  });
});
