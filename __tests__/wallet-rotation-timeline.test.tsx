import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { useWalletRotationStore, maskAddress } from "@/stores/walletRotation";
import { WalletRotationTimeline } from "@/components/features/employees/WalletRotationTimeline";
import type {
  WalletRotationRequest,
  WalletRotationEvent,
} from "@/types";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const EMPLOYEE_ID = "emp-001";
const EMPLOYEE_NAME = "Jane Doe";

const PREVIOUS_WALLET = "GBW6GJMW5SAQXQJT3XNCF6K7YJ5Y7Z2ZG6X4VJQ5XK5Z5X5X5X5X5X5";
const NEW_WALLET = "GCZJQ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z";

function makeRequest(
  overrides: Partial<WalletRotationRequest> = {},
): WalletRotationRequest {
  return {
    id: "rot-001",
    employeeId: EMPLOYEE_ID,
    employeeName: EMPLOYEE_NAME,
    previousWallet: PREVIOUS_WALLET,
    newWallet: NEW_WALLET,
    reasonCode: "scheduled_rotation",
    requestedBy: "admin-actor",
    requestedAt: "2026-01-15T10:00:00Z",
    status: "pending",
    events: [],
    ...overrides,
  };
}

function makeEvent(
  overrides: Partial<WalletRotationEvent> = {},
): WalletRotationEvent {
  return {
    id: "evt-001",
    employeeId: EMPLOYEE_ID,
    type: "rotation_requested",
    timestamp: "2026-01-15T10:00:00Z",
    actor: "admin-actor",
    reasonCode: "scheduled_rotation",
    previousWallet: PREVIOUS_WALLET,
    summary: "Wallet rotation requested",
    ...overrides,
  };
}

// ─── Store reset ────────────────────────────────────────────────────────────

beforeEach(() => {
  useWalletRotationStore.getState().reset();
});

// ─── Unit: maskAddress helper ───────────────────────────────────────────────

describe("maskAddress", () => {
  it("masks a long Stellar address to first 6 + last 4 characters", () => {
    const addr = "GBW6GJMW5SAQXQJT3XNCF6K7YJ5Y7Z2ZG6X4VJQ5XK5Z5X5X5X5X5";
    const masked = maskAddress(addr);
    expect(masked).toBe("GBW6GJ…X5X5");
    expect(masked.length).toBeLessThan(addr.length);
  });

  it("does not mask short addresses", () => {
    const addr = "short";
    expect(maskAddress(addr)).toBe("short");
  });

  it("does not mask addresses of exactly 12 characters", () => {
    const addr = "123456789012";
    expect(maskAddress(addr)).toBe("123456789012");
  });
});

// ─── Empty state ────────────────────────────────────────────────────────────

describe("WalletRotationTimeline: empty state", () => {
  it("shows empty message when no rotation exists for employee", () => {
    render(<WalletRotationTimeline employeeId="emp-none" />);
    expect(
      screen.getByText(/no wallet rotation history/i),
    ).toBeInTheDocument();
  });

  it("renders the heading", () => {
    render(<WalletRotationTimeline employeeId="emp-none" />);
    expect(screen.getByText("Wallet Rotation Timeline")).toBeInTheDocument();
  });
});

// ─── Normal rotation timeline ───────────────────────────────────────────────

describe("WalletRotationTimeline: normal rotation", () => {
  const normalRequest = makeRequest({
    status: "cooldown",
    approvedBy: "approver-1",
    approvedAt: "2026-01-16T09:00:00Z",
    events: [
      makeEvent({
        id: "evt-req",
        type: "rotation_requested",
        timestamp: "2026-01-15T10:00:00Z",
        summary: "Wallet rotation requested",
      }),
      makeEvent({
        id: "evt-approve",
        type: "approval_granted",
        timestamp: "2026-01-16T09:00:00Z",
        actor: "approver-1",
        summary: "Rotation approved",
      }),
      makeEvent({
        id: "evt-cooldown",
        type: "cooldown_activated",
        timestamp: "2026-01-16T09:00:01Z",
        actor: "system",
        reasonCode: "scheduled_rotation",
        summary: "24-hour cooldown activated",
      }),
    ],
  });

  beforeEach(() => {
    useWalletRotationStore.getState().addRequest(normalRequest);
    useWalletRotationStore.getState().activateCooldown(
      normalRequest.id,
      EMPLOYEE_ID,
      24 * 60 * 60 * 1000,
    );
  });

  it("renders the request summary with masked wallet addresses", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(screen.getByText(maskAddress(PREVIOUS_WALLET))).toBeInTheDocument();
    expect(screen.getByText(maskAddress(NEW_WALLET))).toBeInTheDocument();
  });

  it("shows the cooldown warning", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(screen.getByText(/cooldown active/i)).toBeInTheDocument();
    const blocked = screen.getAllByText(/payroll is blocked/i);
    expect(blocked.length).toBeGreaterThanOrEqual(1);
  });

  it("shows all three timeline events", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(screen.getByText("Wallet rotation requested")).toBeInTheDocument();
    expect(screen.getByText("Rotation approved")).toBeInTheDocument();
    expect(screen.getByText("24-hour cooldown activated")).toBeInTheDocument();
  });

  it("shows the status badge with 'cooldown'", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    const statusBadges = screen.getAllByRole("status");
    const cooldownBadge = statusBadges.find((el) =>
      el.getAttribute("aria-label")?.includes("Cooldown"),
    );
    expect(cooldownBadge).toBeInTheDocument();
    expect(cooldownBadge).toHaveTextContent(/cooldown/i);
  });

  it("shows the reason code label", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    const labels = screen.getAllByText("Scheduled Rotation");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows actor names in timeline events", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    const actors = screen.getAllByText(/approver-1/i);
    expect(actors.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the privacy footer", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(
      screen.getByText(/sensitive wallet data is masked/i),
    ).toBeInTheDocument();
  });
});

// ─── Rejected rotation timeline ─────────────────────────────────────────────

describe("WalletRotationTimeline: rejected rotation", () => {
  const rejectedRequest = makeRequest({
    status: "rejected",
    approvedBy: "reviewer-2",
    approvedAt: "2026-01-17T14:00:00Z",
    rejectionReason: "Insufficient justification for rotation.",
    events: [
      makeEvent({
        id: "evt-req",
        type: "rotation_requested",
        timestamp: "2026-01-15T10:00:00Z",
        summary: "Wallet rotation requested",
      }),
      makeEvent({
        id: "evt-reject",
        type: "approval_rejected",
        timestamp: "2026-01-17T14:00:00Z",
        actor: "reviewer-2",
        summary: "Rotation rejected",
      }),
    ],
  });

  beforeEach(() => {
    useWalletRotationStore.getState().addRequest(rejectedRequest);
  });

  it("shows rejection reason", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(
      screen.getByText("Insufficient justification for rotation."),
    ).toBeInTheDocument();
  });

  it("shows rejected status badge", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(screen.getByRole("status")).toHaveTextContent(/rejected/i);
  });

  it("shows rejected-by actor", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(screen.getByText("reviewer-2")).toBeInTheDocument();
  });
});

// ─── Emergency override timeline ────────────────────────────────────────────

describe("WalletRotationTimeline: emergency rotation", () => {
  const emergencyRequest = makeRequest({
    status: "completed",
    isEmergency: true,
    reasonCode: "emergency",
    approvedBy: "security-officer",
    approvedAt: "2026-01-20T02:00:00Z",
    newWallet: NEW_WALLET,
    events: [
      makeEvent({
        id: "evt-req",
        type: "rotation_requested",
        reasonCode: "emergency",
        timestamp: "2026-01-20T01:30:00Z",
        summary: "Emergency wallet rotation requested",
      }),
      makeEvent({
        id: "evt-override",
        type: "emergency_override",
        timestamp: "2026-01-20T01:35:00Z",
        actor: "security-officer",
        reasonCode: "emergency",
        summary: "Emergency override applied — bypassing normal approval",
      }),
      makeEvent({
        id: "evt-approve",
        type: "approval_granted",
        timestamp: "2026-01-20T02:00:00Z",
        actor: "security-officer",
        summary: "Rotation approved (emergency)",
      }),
      makeEvent({
        id: "evt-complete",
        type: "rotation_completed",
        timestamp: "2026-01-20T02:10:00Z",
        actor: "system",
        newWallet: NEW_WALLET,
        summary: "Wallet rotation completed",
      }),
    ],
  });

  beforeEach(() => {
    useWalletRotationStore.getState().addRequest(emergencyRequest);
  });

  it("renders the emergency badge", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(screen.getByText("Emergency Rotation")).toBeInTheDocument();
  });

  it("shows all four emergency timeline events", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(
      screen.getByText("Emergency wallet rotation requested"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Emergency override applied — bypassing normal approval"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Rotation approved (emergency)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Wallet rotation completed")).toBeInTheDocument();
  });

  it("shows completed status badge", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(screen.getByRole("status")).toHaveTextContent(/completed/i);
  });

  it("shows the payroll-blocker warning for completed rotation", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(
      screen.getByText(/wallet rotation completed\. payroll can proceed/i),
    ).toBeInTheDocument();
  });

  it("shows emergency reason code labels", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    const emergencyLabels = screen.getAllByText("Emergency");
    expect(emergencyLabels.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Full address display ───────────────────────────────────────────────────

describe("WalletRotationTimeline: full addresses", () => {
  const request = makeRequest({ status: "completed" });

  beforeEach(() => {
    useWalletRotationStore.getState().addRequest(request);
  });

  it("shows full wallet addresses when showFullAddresses is true", () => {
    render(
      <WalletRotationTimeline
        employeeId={EMPLOYEE_ID}
        showFullAddresses={true}
      />,
    );
    expect(screen.getByText(PREVIOUS_WALLET)).toBeInTheDocument();
    expect(screen.getByText(NEW_WALLET)).toBeInTheDocument();
  });

  it("shows masked addresses by default", () => {
    render(<WalletRotationTimeline employeeId={EMPLOYEE_ID} />);
    expect(screen.getByText(maskAddress(PREVIOUS_WALLET))).toBeInTheDocument();
    expect(screen.getByText(maskAddress(NEW_WALLET))).toBeInTheDocument();
  });
});

// ─── Store unit tests ───────────────────────────────────────────────────────

describe("useWalletRotationStore", () => {
  it("adds a request and retrieves it by employee", () => {
    const req = makeRequest();
    useWalletRotationStore.getState().addRequest(req);
    expect(
      useWalletRotationStore.getState().getRequestForEmployee(EMPLOYEE_ID),
    ).toEqual(req);
  });

  it("approves a request and sets cooldown status", () => {
    const req = makeRequest();
    useWalletRotationStore.getState().addRequest(req);
    useWalletRotationStore.getState().approveRequest(req.id, "approver-1");
    const updated = useWalletRotationStore
      .getState()
      .getRequestForEmployee(EMPLOYEE_ID);
    expect(updated?.status).toBe("cooldown");
    expect(updated?.approvedBy).toBe("approver-1");
  });

  it("rejects a request with reason", () => {
    const req = makeRequest();
    useWalletRotationStore.getState().addRequest(req);
    useWalletRotationStore
      .getState()
      .rejectRequest(req.id, "reviewer-2", "Bad request");
    const updated = useWalletRotationStore
      .getState()
      .getRequestForEmployee(EMPLOYEE_ID);
    expect(updated?.status).toBe("rejected");
    expect(updated?.rejectionReason).toBe("Bad request");
  });

  it("activates and expires cooldown", () => {
    const req = makeRequest({ status: "cooldown" });
    useWalletRotationStore.getState().addRequest(req);
    useWalletRotationStore
      .getState()
      .activateCooldown(req.id, EMPLOYEE_ID, 60000);
    expect(
      useWalletRotationStore.getState().isCooldownActive(EMPLOYEE_ID),
    ).toBe(true);

    useWalletRotationStore.getState().expireCooldown(req.id);
    expect(
      useWalletRotationStore.getState().isCooldownActive(EMPLOYEE_ID),
    ).toBe(false);
  });

  it("completes rotation and clears cooldown", () => {
    const req = makeRequest({ status: "cooldown" });
    useWalletRotationStore.getState().addRequest(req);
    useWalletRotationStore
      .getState()
      .activateCooldown(req.id, EMPLOYEE_ID, 60000);
    useWalletRotationStore.getState().completeRotation(req.id, NEW_WALLET);
    const updated = useWalletRotationStore
      .getState()
      .getRequestForEmployee(EMPLOYEE_ID);
    expect(updated?.status).toBe("completed");
    expect(updated?.newWallet).toBe(NEW_WALLET);
    expect(
      useWalletRotationStore.getState().isCooldownActive(EMPLOYEE_ID),
    ).toBe(false);
  });

  it("returns correct warnings for pending request", () => {
    const req = makeRequest({ status: "pending" });
    useWalletRotationStore.getState().addRequest(req);
    const warnings = useWalletRotationStore
      .getState()
      .getWarningsForEmployee(EMPLOYEE_ID);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe("pending_approval");
  });

  it("returns correct warnings for cooldown request", () => {
    const req = makeRequest({ status: "cooldown" });
    useWalletRotationStore.getState().addRequest(req);
    useWalletRotationStore
      .getState()
      .activateCooldown(req.id, EMPLOYEE_ID, 60000);
    const warnings = useWalletRotationStore
      .getState()
      .getWarningsForEmployee(EMPLOYEE_ID);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe("cooldown_active");
    expect(warnings[0].severity).toBe("warning");
  });

  it("hasActiveRotation returns true for pending/cooldown/approved", () => {
    const req = makeRequest({ status: "pending" });
    useWalletRotationStore.getState().addRequest(req);
    expect(
      useWalletRotationStore.getState().hasActiveRotation(EMPLOYEE_ID),
    ).toBe(true);
  });

  it("hasActiveRotation returns false for completed/failed", () => {
    const req = makeRequest({ status: "completed" });
    useWalletRotationStore.getState().addRequest(req);
    expect(
      useWalletRotationStore.getState().hasActiveRotation(EMPLOYEE_ID),
    ).toBe(false);
  });

  it("resets store to initial state", () => {
    useWalletRotationStore.getState().addRequest(makeRequest());
    useWalletRotationStore.getState().reset();
    expect(
      useWalletRotationStore.getState().getRequestForEmployee(EMPLOYEE_ID),
    ).toBeUndefined();
  });

  it("getEventsForEmployee returns events sorted newest-first", () => {
    const req = makeRequest({
      events: [
        makeEvent({
          id: "old",
          timestamp: "2026-01-01T00:00:00Z",
          summary: "old event",
        }),
        makeEvent({
          id: "new",
          timestamp: "2026-01-02T00:00:00Z",
          summary: "new event",
        }),
      ],
    });
    useWalletRotationStore.getState().addRequest(req);
    const events = useWalletRotationStore
      .getState()
      .getEventsForEmployee(EMPLOYEE_ID);
    expect(events[0].id).toBe("new");
    expect(events[1].id).toBe("old");
  });
});
