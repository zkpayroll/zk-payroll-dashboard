import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReservationTimeline } from "@/components/treasury/ReservationTimeline";
import {
  FundingReservationEvent,
  createFundingReservation,
  updateFundingReservation,
  expireFundingReservation,
  cancelFundingReservation,
  releaseFundingReservation,
  resetFundingReservationEvents,
  clearAllFundingReservationEvents,
} from "@/lib/events/reservationEvents";

const mockEvents: FundingReservationEvent[] = [
  {
    id: "evt_1",
    reservationId: "res_001",
    state: "created",
    createdAt: "2026-08-27T08:00:00Z",
    payrollRunId: "run_aug_1",
    summary: "Treasury reservation created for payroll run",
    amount: 100000,
    actor: "Admin",
  },
  {
    id: "evt_2",
    reservationId: "res_001",
    state: "updated",
    createdAt: "2026-08-27T09:00:00Z",
    payrollRunId: "run_aug_1",
    summary: "Reservation amount adjusted",
    amount: 105000,
    actor: "Operator",
  },
  {
    id: "evt_3",
    reservationId: "res_002",
    state: "released",
    createdAt: "2026-08-27T10:00:00Z",
    payrollRunId: "run_aug_prev",
    summary: "Disbursed funds released back to treasury pool",
    amount: 80000,
    actor: "Contract Executor",
  },
  {
    id: "evt_4",
    reservationId: "res_003",
    state: "expired",
    createdAt: "2026-08-27T11:00:00Z",
    summary: "Unclaimed bonus reservation expired",
    actor: "System",
  },
  {
    id: "evt_5",
    reservationId: "res_004",
    state: "cancelled",
    createdAt: "2026-08-27T12:00:00Z",
    summary: "Reservation cancelled due to cycle rescheduling",
    actor: "Admin",
  },
];

describe("ReservationTimeline Component", () => {
  beforeEach(() => {
    resetFundingReservationEvents();
  });

  it("renders chronological timeline events with state badges and summaries", () => {
    render(<ReservationTimeline initialEvents={mockEvents} />);

    expect(screen.getByText("Funding Reservation Timeline")).toBeInTheDocument();
    expect(screen.getAllByText(/Created/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Updated/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Released/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Expired/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cancelled/i).length).toBeGreaterThan(0);

    expect(screen.getByText("Treasury reservation created for payroll run")).toBeInTheDocument();
    expect(screen.getByText("Reservation amount adjusted")).toBeInTheDocument();
    expect(screen.getByText("Disbursed funds released back to treasury pool")).toBeInTheDocument();
  });

  it("handles empty timeline state gracefully", () => {
    render(<ReservationTimeline initialEvents={[]} />);

    expect(screen.getByTestId("timeline-empty-state")).toBeInTheDocument();
    expect(
      screen.getByText("No reservation timeline events recorded.")
    ).toBeInTheDocument();
  });

  it("filters events by state when filter pills are clicked", async () => {
    const user = userEvent.setup();
    render(<ReservationTimeline initialEvents={mockEvents} />);

    // Click 'released' filter
    const releasedButton = screen.getByRole("button", { name: /^released$/i });
    await user.click(releasedButton);

    expect(screen.getByText("Disbursed funds released back to treasury pool")).toBeInTheDocument();
    expect(
      screen.queryByText("Treasury reservation created for payroll run")
    ).not.toBeInTheDocument();
  });

  it("dynamically updates in real-time when new reservation events are emitted", () => {
    render(<ReservationTimeline initialEvents={[]} />);

    expect(screen.getByText("No reservation timeline events recorded.")).toBeInTheDocument();

    act(() => {
      createFundingReservation("run_live_test", 65000);
    });

    expect(
      screen.getByText(/Funding reserved for payroll run run_live_test/i)
    ).toBeInTheDocument();
    expect(screen.getByText("$65,000")).toBeInTheDocument();
  });

  it("preserves privacy by only showing safe summary amounts and commitments", () => {
    render(<ReservationTimeline initialEvents={mockEvents} />);

    // Check that privacy notice is present
    expect(
      screen.getByText(/Individual employee compensation details are excluded from reservation logs/i)
    ).toBeInTheDocument();

    // Verify safe aggregate amounts are present
    expect(screen.getByText("$100,000")).toBeInTheDocument();
  });
});
