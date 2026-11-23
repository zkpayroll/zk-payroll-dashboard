/**
 * @vitest-environment jsdom
 *
 * Component tests for treasury reservations (Issue #890).
 *
 * Covers:
 *   1. Treasury view reservation empty state and guidance
 *   2. Active healthy reservation rendering and privacy preservation
 *   3. Boundary test: reservation expiring soon (within warning window)
 *   4. Failure/boundary test: expired reservation blocks execution with actionable alert
 *   5. Operational recovery actions: refresh, revalidate, cancel, and permission boundaries
 *   6. Real-Time reservation creation via the "Reserve Funds" button
 *   7. Failure handling: insufficient balance prevents reservation and displays actionable error
 *   8. Reservation timeline integration, filtering, and real-time lifecycle event updates
 *   9. Zero-knowledge privacy verification: zero employee or salary data exposure
 *  10. Full TreasuryPage (app/treasury/page.tsx) integration within DashboardLayout
 */

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TreasuryPage from "@/app/treasury/page";
import TreasuryView from "@/components/features/treasury/TreasuryView";
import {
  useReservationsStore,
  type FundingReservation,
  RESERVATION_TTL_MS,
  RESERVATION_WARNING_WINDOW_MS,
} from "@/stores/reservations";
import {
  createFundingReservation,
  updateFundingReservation,
  expireFundingReservation,
  cancelFundingReservation,
  releaseFundingReservation,
  resetFundingReservationEvents,
  clearAllFundingReservationEvents,
  type FundingReservationEvent,
} from "@/lib/events/reservationEvents";
import { MOCK_EMPLOYEES, MOCK_TREASURY_BALANCE } from "@/lib/api/mockData";
import { toast } from "sonner";

// Mock sonner to inspect toast notifications
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock useSession hook for DashboardLayout
vi.mock("@/hooks/useSession", () => ({
  useSession: () => ({
    sessionInfo: {
      role: "admin",
      publicKey: "GBTESTADMINKEY000000000000000000000000000000000000000000",
      expiresAt: Date.now() + 3600000,
    },
    sessionState: "active",
  }),
}));

const MINUTE = 60 * 1000;

function makeReservation(
  overrides: Partial<FundingReservation> = {},
): FundingReservation {
  return {
    id: "res_test_01",
    batchId: "BATCH-2026-08",
    asset: "USDC",
    amount: "15,000.00",
    reservedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * MINUTE).toISOString(),
    canRefresh: true,
    canCancel: true,
    canRevalidate: true,
    ...overrides,
  };
}

const mockTimelineEvents: FundingReservationEvent[] = [
  {
    id: "evt_test_1",
    reservationId: "res_test_01",
    state: "created",
    createdAt: "2026-08-27T08:00:00Z",
    payrollRunId: "run_aug_01",
    summary: "Treasury reservation created for payroll run run_aug_01",
    amount: 15000,
    actor: "Admin (Auto-scheduler)",
  },
  {
    id: "evt_test_2",
    reservationId: "res_test_01",
    state: "updated",
    createdAt: "2026-08-27T08:30:00Z",
    payrollRunId: "run_aug_01",
    summary: "Reservation amount updated to reflect adjustments",
    amount: 15500,
    actor: "Operator",
  },
  {
    id: "evt_test_3",
    reservationId: "res_test_02",
    state: "released",
    createdAt: "2026-08-27T09:00:00Z",
    payrollRunId: "run_prev_cycle",
    summary: "Reserved funds released back to treasury after settlement",
    amount: 12000,
    actor: "Soroban Verifier",
  },
  {
    id: "evt_test_4",
    reservationId: "res_test_03",
    state: "expired",
    createdAt: "2026-08-27T09:30:00Z",
    summary: "Unclaimed bonus reservation reached expiration deadline",
    amount: 3000,
    actor: "System",
  },
  {
    id: "evt_test_5",
    reservationId: "res_test_04",
    state: "cancelled",
    createdAt: "2026-08-27T10:00:00Z",
    summary: "Reservation cancelled due to cycle rescheduling",
    amount: 8000,
    actor: "Admin",
  },
];

describe("Treasury Reservations Component Suite (#890)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReservationsStore.getState().reset();
    resetFundingReservationEvents();
  });

  describe("1. Empty State & Guidance", () => {
    it("renders actionable guidance when no reservations exist", () => {
      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);

      expect(screen.getByText("No funding reservations found")).toBeInTheDocument();
      expect(
        screen.getByText(/There is no active reservation to review\. Create a new reservation from the payroll workflow/i),
      ).toBeInTheDocument();

      const statusRoles = screen.getAllByRole("status");
      expect(statusRoles.some((el) => el.textContent?.includes("No funding reservations found"))).toBe(true);
    });
  });

  describe("2. Active Reservation Rendering & Privacy Preservation", () => {
    it("renders active healthy reservations with public identifiers and zero employee data exposure", () => {
      useReservationsStore.getState().setReservations([
        makeReservation({
          id: "res_active_1",
          batchId: "BATCH-ALPHA",
          asset: "USDC",
          amount: "15,000.00",
        }),
      ]);

      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);

      // Public batch & asset identifiers
      expect(screen.getByText("Batch BATCH-ALPHA")).toBeInTheDocument();
      expect(screen.getAllByText("USDC").length).toBeGreaterThan(0);
      expect(screen.getByText("15,000.00")).toBeInTheDocument();
      expect(screen.getByText("Healthy")).toBeInTheDocument();

      // Countdown timer element is mounted
      expect(screen.getByTestId("countdown-res_active_1")).toBeInTheDocument();

      // Privacy verification: absolutely no employee names or employee IDs in the reservation card
      const reservationCard = screen.getByTestId("countdown-res_active_1").closest("li")!;
      const cardText = reservationCard.textContent || "";
      for (const emp of MOCK_EMPLOYEES) {
        expect(cardText).not.toContain(emp.name);
        expect(cardText).not.toContain(emp.id);
        expect(cardText).not.toContain(`$${emp.salary}`);
      }
    });
  });

  describe("3. Boundary: Expiring Soon Warning", () => {
    it("displays warning status when reservation is within the warning window without blocking execution", () => {
      const now = Date.now();
      // 2 minutes left (inside the 5-minute warning window)
      const warningExpiresAt = new Date(now + 2 * MINUTE).toISOString();

      useReservationsStore.getState().setReservations([
        makeReservation({
          id: "res_warn",
          batchId: "BATCH-WARN",
          expiresAt: warningExpiresAt,
        }),
      ]);

      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);

      expect(screen.getByText("Expiring soon")).toBeInTheDocument();
      // Not yet expired, so blocking banner should not be present
      expect(
        screen.queryByText("Expired reservations block execution"),
      ).not.toBeInTheDocument();

      // Store execution gate check is still open
      expect(useReservationsStore.getState().canExecute()).toBe(true);
    });
  });

  describe("4. Failure / Boundary: Expired Reservation Blocks Execution", () => {
    it("renders prominent blocking alert and disables execution when a reservation has expired", () => {
      const pastExpiresAt = new Date(Date.now() - MINUTE).toISOString();

      useReservationsStore.getState().setReservations([
        makeReservation({
          id: "res_exp",
          batchId: "BATCH-EXPIRED",
          expiresAt: pastExpiresAt,
        }),
      ]);

      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);

      // Execution blocking alert banner
      const alert = screen.getByText("Expired reservations block execution").closest('[role="alert"]')!;
      expect(alert).toBeInTheDocument();
      expect(
        screen.getByText(/Refresh or revalidate the expired funding reservations below before executing payroll/i),
      ).toBeInTheDocument();

      // Countdown indicates Expired
      expect(screen.getByTestId("countdown-res_exp")).toHaveTextContent("Expired");

      // Store execution gate is blocked
      expect(useReservationsStore.getState().canExecute()).toBe(false);
    });
  });

  describe("5. Operational Recovery Actions & Permissions", () => {
    it("refreshes an expired reservation back to healthy, removing the blocking alert", () => {
      const pastExpiresAt = new Date(Date.now() - MINUTE).toISOString();
      useReservationsStore.getState().setReservations([
        makeReservation({
          id: "res_to_refresh",
          batchId: "BATCH-REFRESH",
          expiresAt: pastExpiresAt,
          canRefresh: true,
        }),
      ]);

      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);

      expect(screen.getByText("Expired reservations block execution")).toBeInTheDocument();

      const refreshBtn = screen.getByRole("button", { name: /^refresh$/i });
      fireEvent.click(refreshBtn);

      // Successfully refreshed: status becomes healthy, blocking banner removed
      expect(
        screen.queryByText("Expired reservations block execution"),
      ).not.toBeInTheDocument();
      expect(useReservationsStore.getState().canExecute()).toBe(true);
    });

    it("revalidates a reservation resetting its timestamps and maintaining healthy status", () => {
      useReservationsStore.getState().setReservations([
        makeReservation({
          id: "res_reval",
          batchId: "BATCH-REVAL",
          canRevalidate: true,
        }),
      ]);

      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);

      const revalidateBtn = screen.getByRole("button", { name: /^revalidate$/i });
      fireEvent.click(revalidateBtn);

      const reservation = useReservationsStore.getState().getReservation("res_reval")!;
      expect(reservation).toBeDefined();
      expect(new Date(reservation.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("cancels a reservation removing it from the store and returning to empty state", () => {
      useReservationsStore.getState().setReservations([
        makeReservation({
          id: "res_to_cancel",
          batchId: "BATCH-CANCEL",
          canCancel: true,
        }),
      ]);

      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);

      expect(screen.getByText("Batch BATCH-CANCEL")).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", { name: /^cancel$/i });
      fireEvent.click(cancelBtn);

      expect(useReservationsStore.getState().reservations).toHaveLength(0);
      expect(screen.getByText("No funding reservations found")).toBeInTheDocument();
    });

    it("disables recovery actions when not permitted", () => {
      useReservationsStore.getState().setReservations([
        makeReservation({
          id: "res_locked",
          canRefresh: false,
          canRevalidate: false,
          canCancel: false,
        }),
      ]);

      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);

      expect(screen.getByRole("button", { name: /^refresh$/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^revalidate$/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();
    });
  });

  describe("6. Real-Time Reservation Creation via UI", () => {
    it("creates a funding reservation, registers it in the store, triggers toast, and appends to timeline", () => {
      render(
        <TreasuryView
          configuredAssets={[{ code: "USDC" }]}
          initialTimelineEvents={mockTimelineEvents}
        />,
      );

      // Initially empty reservations
      expect(screen.getByText("No funding reservations found")).toBeInTheDocument();

      const reserveBtn = screen.getByTestId("reserve-funds-button");
      fireEvent.change(screen.getByTestId("reservation-amount-input"), {
        target: { value: "1234.56" },
      });
      fireEvent.click(reserveBtn);

      // Now registered in store and reflected in UI
      const reservations = useReservationsStore.getState().reservations;
      expect(reservations.length).toBeGreaterThan(0);
      expect(reservations[0].amount).toBe("1234.56");
      expect(screen.queryByText("No funding reservations found")).not.toBeInTheDocument();
      expect(screen.getByText(/Batch BATCH-/i)).toBeInTheDocument();

      // Toast notification triggered
      expect(toast.success).toHaveBeenCalledWith(
        "Funding reservation created",
        expect.objectContaining({
          description: expect.stringMatching(/res_/),
        }),
      );

      // Appended to timeline in real time
      const createdTimelineItems = screen.getAllByText(/Created/i);
      expect(createdTimelineItems.length).toBeGreaterThan(0);
    });

    it("rejects invalid and unaffordable reservation amounts without exposing payroll details", () => {
      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);
      const amountInput = screen.getByTestId("reservation-amount-input");
      const reserveButton = screen.getByTestId("reserve-funds-button");

      fireEvent.change(amountInput, { target: { value: "0" } });
      fireEvent.click(reserveButton);
      expect(screen.getByTestId("reservation-error-alert")).toHaveTextContent(
        "Enter a valid reservation amount greater than zero.",
      );
      expect(useReservationsStore.getState().reservations).toHaveLength(0);

      fireEvent.change(amountInput, { target: { value: "25500.01" } });
      fireEvent.click(reserveButton);
      const alert = screen.getByTestId("reservation-error-alert");
      expect(alert).toHaveTextContent(/exceeds funds available after projected payroll/i);
      expect(alert.textContent).not.toMatch(/emp_[a-zA-Z0-9_-]+|salary/i);
      expect(useReservationsStore.getState().reservations).toHaveLength(0);
    });

    it("accepts a reservation exactly equal to the funds available after projected obligations", () => {
      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);
      fireEvent.change(screen.getByTestId("reservation-amount-input"), {
        target: { value: "25500" },
      });
      fireEvent.click(screen.getByTestId("reserve-funds-button"));

      expect(useReservationsStore.getState().reservations[0]?.amount).toBe("25500.00");
      expect(screen.queryByTestId("reservation-error-alert")).not.toBeInTheDocument();
    });
  });

  describe("7. Failure Handling: Insufficient Funds Guard", () => {
    it("blocks reservation creation and displays actionable error when balance is insufficient", () => {
      // Temporarily mock low balance condition
      const originalBalance = MOCK_TREASURY_BALANCE.balance;
      const originalProjected = MOCK_TREASURY_BALANCE.projectedPayroll;
      MOCK_TREASURY_BALANCE.balance = 1000;
      MOCK_TREASURY_BALANCE.projectedPayroll = 50000;

      try {
        render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);

        const reserveBtn = screen.getByTestId("reserve-funds-button");
        fireEvent.click(reserveBtn);

        // Actionable error banner is displayed
        const errorAlert = screen.getByTestId("reservation-error-alert");
        expect(errorAlert).toBeInTheDocument();
        expect(
          screen.getByText(/Cannot create treasury reservation: available balance is insufficient/i),
        ).toBeInTheDocument();

        // No reservation was added to store
        expect(useReservationsStore.getState().reservations).toHaveLength(0);

        // Verify privacy: no raw employee IDs or salary details
        expect(errorAlert.textContent).not.toMatch(/\bemp_[a-zA-Z0-9_-]+\b/i);

        // Can dismiss the error
        const dismissBtn = screen.getByRole("button", { name: /dismiss reservation error/i });
        fireEvent.click(dismissBtn);
        expect(screen.queryByTestId("reservation-error-alert")).not.toBeInTheDocument();
      } finally {
        MOCK_TREASURY_BALANCE.balance = originalBalance;
        MOCK_TREASURY_BALANCE.projectedPayroll = originalProjected;
      }
    });
  });

  describe("8. Reservation Timeline Integration & Filtering", () => {
    it("renders timeline events and filters by state", async () => {
      const user = userEvent.setup();
      render(
        <TreasuryView
          configuredAssets={[{ code: "USDC" }]}
          initialTimelineEvents={mockTimelineEvents}
        />,
      );

      expect(screen.getByText("Funding Reservation Timeline")).toBeInTheDocument();
      expect(screen.getAllByText("res_test_01").length).toBeGreaterThan(0);
      expect(screen.getByText("res_test_02")).toBeInTheDocument();

      // Filter by "released"
      const releasedFilter = screen.getByRole("button", { name: /^released$/i });
      await user.click(releasedFilter);

      expect(screen.getByText("res_test_02")).toBeInTheDocument();
      expect(screen.queryByText("res_test_03")).not.toBeInTheDocument();

      // Reset to "all"
      const allFilter = screen.getByRole("button", { name: /^all$/i });
      await user.click(allFilter);

      expect(screen.getByText("res_test_03")).toBeInTheDocument();
    });

    it("dynamically updates timeline when reservation lifecycle events are emitted", () => {
      render(
        <TreasuryView
          configuredAssets={[{ code: "USDC" }]}
          initialTimelineEvents={[]}
        />,
      );

      // Initially empty
      expect(screen.getByTestId("timeline-empty-state")).toBeInTheDocument();

      // Emit new release event
      act(() => {
        releaseFundingReservation("res_live_release", "Funds released after proof verification");
      });

      expect(screen.queryByTestId("timeline-empty-state")).not.toBeInTheDocument();
      expect(screen.getByText("res_live_release")).toBeInTheDocument();
      expect(screen.getByText("Funds released after proof verification")).toBeInTheDocument();
    });
  });

  describe("9. Zero-Knowledge Privacy Preservation", () => {
    it("protects private employee payroll data across all reservation components", () => {
      useReservationsStore.getState().setReservations([
        makeReservation({
          id: "res_zk_1",
          batchId: "BATCH-ZK",
          amount: "15,000.00",
        }),
      ]);

      render(
        <TreasuryView
          configuredAssets={[{ code: "USDC" }]}
          initialTimelineEvents={mockTimelineEvents}
        />,
      );

      const timelineEl = screen.getByTestId("reservation-timeline");
      const warningEl = screen.getByText("Batch BATCH-ZK").closest("li")!;
      const reservationContent = (timelineEl.textContent || "") + " " + (warningEl.textContent || "");

      // Ensure no employee ID patterns
      expect(reservationContent).not.toMatch(/\bemp_[a-zA-Z0-9_-]+\b/i);

      // Ensure no mock employee full names or salaries in reservation areas
      for (const emp of MOCK_EMPLOYEES) {
        expect(reservationContent).not.toContain(emp.name);
        expect(reservationContent).not.toContain(emp.id);
        expect(reservationContent).not.toContain(`$${emp.salary}`);
      }

      // Zero-knowledge privacy notice is present in timeline
      expect(
        screen.getByText(/Zero-Knowledge: Individual employee compensation details are excluded/i),
      ).toBeInTheDocument();
    });
  });

  describe("10. Full TreasuryPage Integration within DashboardLayout", () => {
    it("renders TreasuryPage with layout and all reservation subcomponents", () => {
      render(<TreasuryPage configuredAssets={[{ code: "USDC" }]} />);

      // Treasury heading from TreasuryView
      expect(screen.getByRole("heading", { name: "Treasury" })).toBeInTheDocument();

      // Available Balance card
      expect(screen.getAllByText(/Available [Bb]alance/).length).toBeGreaterThan(0);

      // Reservation subcomponents mounted
      expect(screen.getByTestId("treasury-reservation-guidance-card")).toBeInTheDocument();
      expect(screen.getByText("No funding reservations found")).toBeInTheDocument();
      expect(screen.getByText("Funding Reservation Timeline")).toBeInTheDocument();
      expect(screen.getByTestId("reserve-funds-button")).toBeInTheDocument();
    });
  });

  describe("11. Structured Reservation Guidance & Security Hardening (#887)", () => {
    it("transitions guidance card across empty, healthy, warning, and locked-expired states", () => {
      const { rerender } = render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);
      const card = () => screen.getByTestId("treasury-reservation-guidance-card");

      expect(card()).toHaveAttribute("data-reason", "NO_ACTIVE_RESERVATIONS");
      expect(card()).toHaveAttribute("data-tone", "info");
      expect(screen.getByTestId("treasury-reservation-action-guides")).toBeInTheDocument();

      // Active healthy reservation
      act(() => {
        useReservationsStore.getState().setReservations([
          makeReservation({
            id: "res_h",
            batchId: "BATCH-H1",
            amount: "15,000.00",
            expiresAt: new Date(Date.now() + 25 * MINUTE).toISOString(),
          }),
        ]);
      });
      rerender(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);
      expect(card()).toHaveAttribute("data-reason", "RESERVATIONS_HEALTHY");
      expect(card()).toHaveAttribute("data-tone", "ready");
      expect(screen.getByTestId("reservation-item-guidance-res_h")).toHaveTextContent(
        /ready for payroll settlement/i,
      );

      // Entering warning window
      act(() => {
        useReservationsStore.getState().setReservations([
          makeReservation({
            id: "res_w",
            batchId: "BATCH-W1",
            amount: "15,000.00",
            expiresAt: new Date(Date.now() + 2 * MINUTE).toISOString(),
          }),
        ]);
      });
      rerender(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);
      expect(card()).toHaveAttribute("data-reason", "RESERVATION_EXPIRING_SOON");
      expect(card()).toHaveAttribute("data-tone", "warning");
      expect(screen.getByTestId("expiring-soon-guidance-banner")).toBeInTheDocument();

      // Expired and locked (canRefresh: false, canRevalidate: false)
      act(() => {
        useReservationsStore.getState().setReservations([
          makeReservation({
            id: "res_l",
            batchId: "BATCH-L1",
            amount: "15,000.00",
            expiresAt: new Date(Date.now() - MINUTE).toISOString(),
            canRefresh: false,
            canRevalidate: false,
            canCancel: true,
          }),
        ]);
      });
      rerender(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);
      expect(card()).toHaveAttribute("data-reason", "RESERVATION_EXPIRED_LOCKED");
      expect(card()).toHaveAttribute("data-tone", "blocked");
      expect(screen.getByTestId("locked-expired-guidance")).toBeInTheDocument();
      expect(screen.getByTestId("reservation-item-guidance-res_l")).toHaveTextContent(
        /Cancel to free the slot/i,
      );
    });

    it("blocks cumulative over-reservation when repeated clicks exhaust unreserved liquidity", () => {
      render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);
      const amountInput = screen.getByTestId("reservation-amount-input");
      const reserveBtn = screen.getByTestId("reserve-funds-button");

      // Default balance is 45,000 USDC, remaining after projected is 25,500 USDC
      fireEvent.change(amountInput, { target: { value: "20000" } });
      fireEvent.click(reserveBtn);
      fireEvent.click(reserveBtn);
      expect(useReservationsStore.getState().reservations).toHaveLength(2);
      expect(screen.queryByTestId("reservation-error-alert")).not.toBeInTheDocument();

      // 3rd lock of 20,000 exceeds remaining 5,000 USDC unreserved liquidity
      fireEvent.click(reserveBtn);
      expect(useReservationsStore.getState().reservations).toHaveLength(2);
      const alert = screen.getByTestId("reservation-error-alert");
      expect(alert).toHaveTextContent(
        /existing active reservations leave insufficient unreserved liquidity for an additional 20,000 USDC lock/i,
      );
    });

    it("surfaces asset configuration guidance when reserving without configured assets", () => {
      render(<TreasuryView configuredAssets={[]} />);
      fireEvent.click(screen.getByTestId("reserve-funds-button"));
      expect(screen.getByTestId("reservation-error-alert")).toHaveTextContent(
        /configure at least one supported Stellar payroll asset/i,
      );
      expect(useReservationsStore.getState().reservations).toHaveLength(0);
    });

    it("fails closed on malformed timestamps, corrupt amounts, and null prop entries while sanitizing DOM/title attributes", () => {
      const syntheticPub = "G" + "A".repeat(55);
      const { container } = render(
        <TreasuryView
          configuredAssets={[{ code: "USDC" }]}
          initialReservations={[
            null as unknown as FundingReservation,
            makeReservation({
              id: "res_bad_1",
              batchId: `BATCH_${syntheticPub}_emp_77`,
              amount: "-500",
              expiresAt: "invalid-iso-date",
            }),
          ]}
          initialTimelineEvents={mockTimelineEvents}
        />,
      );

      expect(screen.getByTestId("corrupt-reservations-alert")).toBeInTheDocument();
      expect(screen.getByTestId("countdown-res_bad_1")).toHaveTextContent("Expired");
      expect(screen.getByTestId("countdown-res_bad_1")).not.toHaveTextContent(/NaN/i);
      expect(screen.getByText("Invalid amount")).toBeInTheDocument();
      expect(screen.getByTestId("treasury-reservation-guidance-card")).toHaveAttribute(
        "data-reason",
        "INVALID_TREASURY_DATA",
      );

      // Deep privacy check across rendered HTML, attributes, and localStorage
      expect(container.innerHTML).not.toContain(syntheticPub);
      expect(container.innerHTML).not.toContain("emp_77");
      const titleEls = container.querySelectorAll("[title]");
      titleEls.forEach((el) => {
        const titleVal = el.getAttribute("title") || "";
        expect(titleVal).not.toContain(syntheticPub);
        expect(titleVal).not.toContain("emp_77");
      });
      const serializedStorage = JSON.stringify(window.localStorage);
      expect(serializedStorage).not.toContain(syntheticPub);
      expect(serializedStorage).not.toContain("emp_77");
    });
  });
});
