import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import TemporaryApproverDelegationPanel from "@/components/features/approvals/TemporaryApproverDelegationPanel";
import {
  useDelegatedApproversStore,
  getTemporaryDelegationStatus,
  isTemporaryDelegationActive,
  MAX_TEMPORARY_DELEGATION_MS,
  type TemporaryDelegation,
} from "@/stores/delegatedApprovers";

const ADDRESS_A = "GAYN325M3W4R3J2J53X2Z3Q4W5E6R7T8Y9U0I1O2P3A4S5D6F7G8H9J0";
const ADDRESS_B = "GB7N6543210987654321098765432109876543210987654321098765";

const HOUR_MS = 60 * 60 * 1000;

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe("Temporary approver delegation controls (Issue #616)", () => {
  beforeEach(() => {
    useDelegatedApproversStore.setState({
      temporaryDelegations: [],
    });
  });

  // ── Store: success / failure / edge ────────────────────────────────────────

  it("schedules a valid temporary delegation", () => {
    const res = useDelegatedApproversStore
      .getState()
      .addTemporaryDelegation({
        address: ADDRESS_A,
        label: "Acting Finance Lead",
        startsAt: iso(HOUR_MS),
        expiresAt: iso(48 * HOUR_MS),
      });

    expect(res.success).toBe(true);
    expect(res.delegation?.address).toBe(ADDRESS_A);

    const stored = useDelegatedApproversStore.getState().temporaryDelegations;
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe("Acting Finance Lead");
    expect(getTemporaryDelegationStatus(stored[0], Date.parse(iso(0)))).toBe(
      "scheduled",
    );
    expect(
      isTemporaryDelegationActive(stored[0], Date.parse(iso(24 * HOUR_MS))),
    ).toBe(true);
  });

  it("rejects an invalid address with an actionable error", () => {
    const res = useDelegatedApproversStore
      .getState()
      .addTemporaryDelegation({
        address: "not a valid address!!",
        startsAt: iso(HOUR_MS),
        expiresAt: iso(2 * HOUR_MS),
      });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid address format/i);
    expect(useDelegatedApproversStore.getState().temporaryDelegations).toHaveLength(0);
  });

  it("rejects an expiry that ends before or at the start (edge case)", () => {
    const atStart = useDelegatedApproversStore
      .getState()
      .addTemporaryDelegation({
        address: ADDRESS_A,
        startsAt: iso(2 * HOUR_MS),
        expiresAt: iso(2 * HOUR_MS),
      });
    expect(atStart.success).toBe(false);
    expect(atStart.error).toMatch(/end time must be after the start/i);

    const beforeStart = useDelegatedApproversStore
      .getState()
      .addTemporaryDelegation({
        address: ADDRESS_A,
        startsAt: iso(4 * HOUR_MS),
        expiresAt: iso(2 * HOUR_MS),
      });
    expect(beforeStart.success).toBe(false);
    expect(beforeStart.error).toMatch(/end time must be after the start/i);
  });

  it("caps temporary delegations at 30 days", () => {
    const res = useDelegatedApproversStore
      .getState()
      .addTemporaryDelegation({
        address: ADDRESS_A,
        startsAt: iso(0),
        expiresAt: iso(MAX_TEMPORARY_DELEGATION_MS + HOUR_MS),
      });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/capped at 30 days/i);
  });

  it("blocks a duplicate active delegation but allows one after revocation (edge case)", () => {
    const first = useDelegatedApproversStore
      .getState()
      .addTemporaryDelegation({
        address: ADDRESS_B,
        startsAt: iso(0),
        expiresAt: iso(48 * HOUR_MS),
      });
    expect(first.success).toBe(true);

    const duplicate = useDelegatedApproversStore
      .getState()
      .addTemporaryDelegation({
        address: ADDRESS_B,
        startsAt: iso(0),
        expiresAt: iso(24 * HOUR_MS),
      });
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toMatch(/active temporary delegation already exists/i);

    useDelegatedApproversStore.getState().revokeTemporaryDelegation(ADDRESS_B);
    const afterRevoke = useDelegatedApproversStore
      .getState()
      .addTemporaryDelegation({
        address: ADDRESS_B,
        startsAt: iso(0),
        expiresAt: iso(24 * HOUR_MS),
      });
    expect(afterRevoke.success).toBe(true);
  });

  it("revocation takes precedence over active status", () => {
    useDelegatedApproversStore.getState().addTemporaryDelegation({
      address: ADDRESS_A,
      startsAt: iso(0),
      expiresAt: iso(48 * HOUR_MS),
    });
    const delegation = useDelegatedApproversStore.getState().temporaryDelegations[0];
    expect(
      getTemporaryDelegationStatus(delegation, Date.parse(iso(HOUR_MS))),
    ).toBe("active");

    useDelegatedApproversStore.getState().revokeTemporaryDelegation(delegation.id);
    const revoked = useDelegatedApproversStore.getState().temporaryDelegations[0];
    expect(revoked.revokedAt).toBeTruthy();
    expect(
      getTemporaryDelegationStatus(revoked, Date.parse(iso(HOUR_MS))),
    ).toBe("revoked");
    expect(
      isTemporaryDelegationActive(revoked, Date.parse(iso(HOUR_MS))),
    ).toBe(false);
  });

  // ── Panel: controls + actionable errors ────────────────────────────────────

  it("renders the panel and schedules a delegation through the form", () => {
    render(<TemporaryApproverDelegationPanel />);

    fireEvent.change(
      screen.getByLabelText(/Stellar Address or Delegate Identifier/i),
      { target: { value: ADDRESS_A } },
    );
    fireEvent.change(screen.getByLabelText(/Role \/ Description/i), {
      target: { value: "Acting Finance Lead" },
    });
    fireEvent.change(screen.getByLabelText(/Starts At/i), {
      target: { value: "2026-10-20T09:00" },
    });
    fireEvent.change(screen.getByLabelText(/Expires At/i), {
      target: { value: "2026-10-22T09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Schedule Delegation/i }));

    expect(screen.getByText(/Acting Finance Lead/i)).toBeInTheDocument();
    expect(
      useDelegatedApproversStore.getState().temporaryDelegations,
    ).toHaveLength(1);
  });

  it("surfaces actionable form errors for a missing window and an invalid address", () => {
    render(<TemporaryApproverDelegationPanel />);

    fireEvent.click(screen.getByRole("button", { name: /Schedule Delegation/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/start and end times are required/i);

    fireEvent.change(
      screen.getByLabelText(/Stellar Address or Delegate Identifier/i),
      { target: { value: "not valid!!" } },
    );
    fireEvent.change(screen.getByLabelText(/Starts At/i), {
      target: { value: "2026-10-20T09:00" },
    });
    fireEvent.change(screen.getByLabelText(/Expires At/i), {
      target: { value: "2026-10-21T09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Schedule Delegation/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Invalid address format/i);
  });

  it("revokes an active delegation from the list and shows status badges", () => {
    const delegation: TemporaryDelegation = {
      id: "temp_del_test_1",
      address: ADDRESS_A,
      label: "Treasury Delegate",
      startsAt: iso(-HOUR_MS),
      expiresAt: iso(24 * HOUR_MS),
      createdAt: iso(-2 * HOUR_MS),
    };
    useDelegatedApproversStore.setState({ temporaryDelegations: [delegation] });

    render(
      <TemporaryApproverDelegationPanel now={Date.parse(iso(0))} />,
    );

    expect(screen.getByText(/Active/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Revoke delegation for/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Revoke delegation for/i }),
    );

    expect(screen.getByText(/Revoked/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revoke delegation for/i })).toBeNull();
    expect(
      useDelegatedApproversStore.getState().temporaryDelegations[0].revokedAt,
    ).toBeTruthy();
  });
});
