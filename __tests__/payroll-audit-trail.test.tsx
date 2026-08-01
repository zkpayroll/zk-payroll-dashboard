import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  usePayrollAuditTrailStore,
  getActionLabel,
  type PayrollApprovalActionType,
} from "@/stores/payrollAuditTrail";
import PayrollApprovalAuditTrail from "@/components/features/payroll/PayrollApprovalAuditTrail";

describe("usePayrollAuditTrailStore", () => {
  beforeEach(() => {
    usePayrollAuditTrailStore.setState({ events: [] });
  });

  it("starts with an empty events array", () => {
    const state = usePayrollAuditTrailStore.getState();
    expect(state.events).toEqual([]);
  });

  it("logs a new event with generated id and timestamp", () => {
    const { logEvent, events } = usePayrollAuditTrailStore.getState();

    logEvent({
      payrollRunId: "run_001",
      action: "draft_created",
      actor: "Admin User",
      actorRole: "admin",
      details: "Test payroll run created",
    });

    const updated = usePayrollAuditTrailStore.getState().events;
    expect(updated).toHaveLength(1);
    expect(updated[0].payrollRunId).toBe("run_001");
    expect(updated[0].action).toBe("draft_created");
    expect(updated[0].actor).toBe("Admin User");
    expect(updated[0].actorRole).toBe("admin");
    expect(updated[0].details).toBe("Test payroll run created");
    expect(updated[0].id).toMatch(/^paat_/);
    expect(() => new Date(updated[0].timestamp)).not.toThrow();
  });

  it("logs multiple events for the same run", () => {
    const { logEvent } = usePayrollAuditTrailStore.getState();

    logEvent({
      payrollRunId: "run_001",
      action: "draft_created",
      actor: "Admin User",
      actorRole: "admin",
    });

    logEvent({
      payrollRunId: "run_001",
      action: "review_initiated",
      actor: "Admin User",
      actorRole: "admin",
    });

    logEvent({
      payrollRunId: "run_001",
      action: "submitted",
      actor: "Admin User",
      actorRole: "admin",
    });

    expect(usePayrollAuditTrailStore.getState().events).toHaveLength(3);
  });

  it("retrieves events filtered by payrollRunId", () => {
    const { logEvent } = usePayrollAuditTrailStore.getState();

    logEvent({ payrollRunId: "run_001", action: "draft_created", actor: "Admin" });
    logEvent({ payrollRunId: "run_001", action: "submitted", actor: "Admin" });
    logEvent({ payrollRunId: "run_002", action: "draft_created", actor: "Admin" });

    const run001Events = usePayrollAuditTrailStore.getState().getEventsForRun("run_001");
    expect(run001Events).toHaveLength(2);

    const run002Events = usePayrollAuditTrailStore.getState().getEventsForRun("run_002");
    expect(run002Events).toHaveLength(1);
  });

  it("clears events for a specific run", () => {
    const { logEvent, clearEventsForRun } = usePayrollAuditTrailStore.getState();

    logEvent({ payrollRunId: "run_001", action: "draft_created", actor: "Admin" });
    logEvent({ payrollRunId: "run_002", action: "draft_created", actor: "Admin" });

    clearEventsForRun("run_001");

    const remaining = usePayrollAuditTrailStore.getState().events;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].payrollRunId).toBe("run_002");
  });

  it("supports all approval action types", () => {
    const { logEvent } = usePayrollAuditTrailStore.getState();
    const actions: PayrollApprovalActionType[] = [
      "draft_created",
      "review_initiated",
      "proof_generated",
      "proof_failed",
      "wallet_signing",
      "cancelled",
      "submitted",
      "submission_failed",
    ];

    actions.forEach((action, index) => {
      logEvent({
        payrollRunId: `run_${index}`,
        action,
        actor: "Tester",
      });
    });

    const allEvents = usePayrollAuditTrailStore.getState().events;
    expect(allEvents).toHaveLength(actions.length);

    const loggedActions = allEvents.map((e) => e.action);
    actions.forEach((action) => {
      expect(loggedActions).toContain(action);
    });
  });
});

describe("getActionLabel", () => {
  it("returns human-readable label for each action type", () => {
    expect(getActionLabel("draft_created")).toBe("Draft Created");
    expect(getActionLabel("review_initiated")).toBe("Review Initiated");
    expect(getActionLabel("proof_generated")).toBe("Proof Generated");
    expect(getActionLabel("proof_failed")).toBe("Proof Failed");
    expect(getActionLabel("wallet_signing")).toBe("Wallet Signing");
    expect(getActionLabel("cancelled")).toBe("Cancelled");
    expect(getActionLabel("submitted")).toBe("Submitted");
    expect(getActionLabel("submission_failed")).toBe("Submission Failed");
  });
});

describe("PayrollApprovalAuditTrail", () => {
  beforeEach(() => {
    usePayrollAuditTrailStore.setState({ events: [] });
  });

  it("renders empty state when no events exist", () => {
    render(<PayrollApprovalAuditTrail payrollRunId="run_001" />);
    expect(screen.getByText("Approval Audit Trail")).toBeInTheDocument();
    expect(screen.getByText("No approval events recorded yet.")).toBeInTheDocument();
  });

  it("renders with events and shows event count", () => {
    const { logEvent } = usePayrollAuditTrailStore.getState();

    logEvent({
      payrollRunId: "run_001",
      action: "draft_created",
      actor: "Admin User",
      actorRole: "admin",
      details: "Payroll started",
    });

    logEvent({
      payrollRunId: "run_001",
      action: "submitted",
      actor: "Admin User",
      actorRole: "admin",
      details: "Payroll submitted",
    });

    render(<PayrollApprovalAuditTrail payrollRunId="run_001" />);

    expect(screen.getByText("Approval Audit Trail")).toBeInTheDocument();
    expect(screen.getByText("2 events")).toBeInTheDocument();
    expect(screen.getByText("Draft Created")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Payroll started")).toBeInTheDocument();
    expect(screen.getByText("Payroll submitted")).toBeInTheDocument();
    // Actor text appears once per event (both have same actor)
    const actorElements = screen.getAllByText(/Admin User/);
    expect(actorElements.length).toBe(2);
  });

  it("does not render events for other run IDs", () => {
    const { logEvent } = usePayrollAuditTrailStore.getState();

    logEvent({
      payrollRunId: "run_001",
      action: "draft_created",
      actor: "Admin",
    });

    render(<PayrollApprovalAuditTrail payrollRunId="run_002" />);
    expect(screen.getByText("No approval events recorded yet.")).toBeInTheDocument();
  });

  it("returns null in compact mode when no events exist", () => {
    const { container } = render(
      <PayrollApprovalAuditTrail payrollRunId="run_001" compact />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders in compact mode with events", () => {
    const { logEvent } = usePayrollAuditTrailStore.getState();

    logEvent({
      payrollRunId: "run_001",
      action: "draft_created",
      actor: "Admin",
    });

    const { container } = render(
      <PayrollApprovalAuditTrail payrollRunId="run_001" compact />,
    );
    expect(screen.getByText("Approval Audit Trail")).toBeInTheDocument();
    expect(container.firstChild).not.toBeNull();
  });

  it("sorts events with most recent first", () => {
    const { logEvent } = usePayrollAuditTrailStore.getState();

    // Manually set events with controlled timestamps
    usePayrollAuditTrailStore.setState({
      events: [
        {
          id: "paat_1",
          payrollRunId: "run_001",
          action: "draft_created",
          actor: "Admin",
          timestamp: "2025-01-01T00:00:00Z",
        },
        {
          id: "paat_2",
          payrollRunId: "run_001",
          action: "submitted",
          actor: "Admin",
          timestamp: "2025-06-01T00:00:00Z",
        },
      ],
    });

    render(<PayrollApprovalAuditTrail payrollRunId="run_001" />);

    // The events should appear in order: submitted first (most recent), then draft_created
    const eventLabels = screen.getAllByText(/Draft Created|Submitted/);
    expect(eventLabels[0]).toHaveTextContent("Submitted");
    expect(eventLabels[1]).toHaveTextContent("Draft Created");
  });
});
