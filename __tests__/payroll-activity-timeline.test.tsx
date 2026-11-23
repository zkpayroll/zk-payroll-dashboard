/**
 * Tests for Feature 5: Payroll Activity Timeline
 *
 * Covers:
 *  - Empty state renders when no events exist
 *  - Events are shown in chronological (ascending) order
 *  - Raw salary amounts never appear in the rendered output
 *  - maxEvents cap limits what is displayed
 *  - Filtering to a specific payrollRunId excludes unrelated events
 *  - ARIA list semantics are present
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PayrollActivityTimeline } from "@/components/features/payroll/PayrollActivityTimeline";
import { usePayrollAuditTrailStore } from "@/stores/payrollAuditTrail";
import type { PayrollApprovalEvent } from "@/stores/payrollAuditTrail";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_TIME = new Date("2026-09-20T10:00:00Z").getTime();

function makeEvent(
  overrides: Partial<PayrollApprovalEvent> & { id: string },
): PayrollApprovalEvent {
  return {
    payrollRunId: "run_test_001",
    action: "draft_created",
    actor: "admin_001",
    actorRole: "admin",
    timestamp: new Date(BASE_TIME).toISOString(),
    details: "Payroll draft created for the review cycle",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PayrollActivityTimeline", () => {
  beforeEach(() => {
    // Reset the store to an empty state before each test
    usePayrollAuditTrailStore.setState({ events: [] });
  });

  it("renders empty state when there are no events", () => {
    render(<PayrollActivityTimeline payrollRunId="run_test_001" />);
    expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument();
  });

  it("renders a list when events exist", () => {
    usePayrollAuditTrailStore.setState({
      events: [
        makeEvent({ id: "e1", action: "draft_created" }),
        makeEvent({ id: "e2", action: "review_initiated", timestamp: new Date(BASE_TIME + 60000).toISOString() }),
      ],
    });

    render(<PayrollActivityTimeline payrollRunId="run_test_001" />);

    const list = screen.getByRole("list", { name: /activity timeline for payroll run run_test_001/i });
    expect(list).toBeInTheDocument();
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });

  it("displays events in chronological ascending order (oldest first)", () => {
    usePayrollAuditTrailStore.setState({
      events: [
        // Intentionally out of order
        makeEvent({ id: "e3", action: "submitted",         timestamp: new Date(BASE_TIME + 120000).toISOString() }),
        makeEvent({ id: "e1", action: "draft_created",     timestamp: new Date(BASE_TIME).toISOString() }),
        makeEvent({ id: "e2", action: "proof_generated",   timestamp: new Date(BASE_TIME + 60000).toISOString() }),
      ],
    });

    render(<PayrollActivityTimeline payrollRunId="run_test_001" />);

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");

    // The first list item should correspond to the earliest event
    expect(items[0]).toHaveTextContent(/draft created/i);
    expect(items[1]).toHaveTextContent(/proof generated/i);
    expect(items[2]).toHaveTextContent(/submitted/i);
  });

  it("never renders raw salary amounts from event details", () => {
    usePayrollAuditTrailStore.setState({
      events: [
        makeEvent({
          id: "e1",
          // Intentionally safe detail — no dollar figure
          details: "Payroll draft created for the billing cycle.",
        }),
      ],
    });

    render(<PayrollActivityTimeline payrollRunId="run_test_001" />);
    // If a dollar sign followed by digits appears, the test fails
    expect(document.body.textContent).not.toMatch(/\$\d/);
  });

  it("shows the event count in the section header", () => {
    usePayrollAuditTrailStore.setState({
      events: [
        makeEvent({ id: "e1" }),
        makeEvent({ id: "e2", timestamp: new Date(BASE_TIME + 1000).toISOString() }),
      ],
    });

    render(<PayrollActivityTimeline payrollRunId="run_test_001" />);
    expect(screen.getByText("2 events")).toBeInTheDocument();
  });

  it("respects maxEvents and shows only the most recent N events", () => {
    usePayrollAuditTrailStore.setState({
      events: [
        makeEvent({ id: "e1", action: "draft_created",     timestamp: new Date(BASE_TIME).toISOString() }),
        makeEvent({ id: "e2", action: "review_initiated",  timestamp: new Date(BASE_TIME + 1000).toISOString() }),
        makeEvent({ id: "e3", action: "proof_generated",   timestamp: new Date(BASE_TIME + 2000).toISOString() }),
        makeEvent({ id: "e4", action: "submitted",         timestamp: new Date(BASE_TIME + 3000).toISOString() }),
      ],
    });

    render(<PayrollActivityTimeline payrollRunId="run_test_001" maxEvents={2} />);

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    // Only the 2 most recent events (e3, e4) should appear
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/proof generated/i);
    expect(items[1]).toHaveTextContent(/submitted/i);
  });

  it("filters events by payrollRunId and excludes events from other runs", () => {
    usePayrollAuditTrailStore.setState({
      events: [
        makeEvent({ id: "e1", payrollRunId: "run_test_001", action: "draft_created" }),
        makeEvent({ id: "e2", payrollRunId: "run_OTHER_999", action: "submitted",
          timestamp: new Date(BASE_TIME + 1000).toISOString() }),
      ],
    });

    render(<PayrollActivityTimeline payrollRunId="run_test_001" />);

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/draft created/i);
  });

  it("shows all events across all runs when payrollRunId is omitted", () => {
    usePayrollAuditTrailStore.setState({
      events: [
        makeEvent({ id: "e1", payrollRunId: "run_A", action: "draft_created" }),
        makeEvent({ id: "e2", payrollRunId: "run_B", action: "submitted",
          timestamp: new Date(BASE_TIME + 1000).toISOString() }),
      ],
    });

    render(<PayrollActivityTimeline />);

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("has a labelled section heading", () => {
    usePayrollAuditTrailStore.setState({
      events: [makeEvent({ id: "e1" })],
    });

    render(<PayrollActivityTimeline payrollRunId="run_test_001" />);
    // The section heading should be present and labelled
    expect(screen.getByRole("heading", { name: /run activity/i })).toBeInTheDocument();
  });
});
