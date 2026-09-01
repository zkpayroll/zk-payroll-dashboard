import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ReservationExpiryWarning from "@/components/features/treasury/ReservationExpiryWarning";
import {
  useReservationsStore,
  getReservationStatus,
  getTimeRemaining,
  type FundingReservation,
} from "@/stores/reservations";

const MINUTE = 60 * 1000;

function makeReservation(
  overrides: Partial<FundingReservation> = {},
): FundingReservation {
  return {
    id: "res_1",
    batchId: "BATCH-001",
    asset: "USDC",
    amount: "12,500.00",
    reservedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * MINUTE).toISOString(),
    canRefresh: true,
    canCancel: true,
    canRevalidate: true,
    ...overrides,
  };
}

describe("getReservationStatus", () => {
  const now = 1_000_000_000;

  it("is healthy well before expiry", () => {
    const r = { expiresAt: new Date(now + 30 * MINUTE).toISOString() };
    expect(getReservationStatus(r, now)).toBe("healthy");
  });

  it("is warning inside the warning window", () => {
    const r = { expiresAt: new Date(now + 2 * MINUTE).toISOString() };
    expect(getReservationStatus(r, now)).toBe("warning");
  });

  it("is expired at the moment of expiry (boundary)", () => {
    const r = { expiresAt: new Date(now).toISOString() };
    expect(getReservationStatus(r, now)).toBe("expired");
  });

  it("is expired after expiry", () => {
    const r = { expiresAt: new Date(now - MINUTE).toISOString() };
    expect(getReservationStatus(r, now)).toBe("expired");
  });

  it("treats the exact warning-window edge as warning, not expired", () => {
    const r = { expiresAt: new Date(now + 5 * MINUTE).toISOString() };
    expect(getReservationStatus(r, now)).toBe("warning");
  });

  it("clamps remaining time to zero once expired", () => {
    const r = { expiresAt: new Date(now - MINUTE).toISOString() };
    expect(getTimeRemaining(r, now)).toBe(0);
  });
});

describe("reservations store", () => {
  beforeEach(() => {
    useReservationsStore.getState().reset();
  });

  it("refresh extends expiry only when allowed", () => {
    const past = new Date(Date.now() - MINUTE).toISOString();
    useReservationsStore.getState().setReservations([
      makeReservation({ id: "a", expiresAt: past, canRefresh: true }),
      makeReservation({ id: "b", expiresAt: past, canRefresh: false }),
    ]);

    useReservationsStore.getState().refreshReservation("a");
    useReservationsStore.getState().refreshReservation("b");

    const a = useReservationsStore.getState().getReservation("a")!;
    const b = useReservationsStore.getState().getReservation("b")!;
    expect(getReservationStatus(a)).toBe("healthy");
    expect(getReservationStatus(b)).toBe("expired");
  });

  it("cancel removes only when allowed", () => {
    useReservationsStore.getState().setReservations([
      makeReservation({ id: "a", canCancel: true }),
      makeReservation({ id: "b", canCancel: false }),
    ]);

    useReservationsStore.getState().cancelReservation("a");
    useReservationsStore.getState().cancelReservation("b");

    expect(useReservationsStore.getState().getReservation("a")).toBeUndefined();
    expect(useReservationsStore.getState().getReservation("b")).toBeDefined();
  });

  it("blocks execution while an expired reservation exists", () => {
    useReservationsStore.getState().setReservations([
      makeReservation({
        id: "a",
        expiresAt: new Date(Date.now() - MINUTE).toISOString(),
      }),
    ]);
    expect(useReservationsStore.getState().canExecute()).toBe(false);

    useReservationsStore.getState().revalidateReservation("a");
    expect(useReservationsStore.getState().canExecute()).toBe(true);
  });
});

describe("ReservationExpiryWarning", () => {
  beforeEach(() => {
    useReservationsStore.getState().reset();
  });

  it("shows a reassuring empty state when there are no reservations", () => {
    render(<ReservationExpiryWarning />);
    expect(
      screen.getByText("No funding reservations require attention"),
    ).toBeInTheDocument();
  });

  it("renders a healthy reservation with its identifiers", () => {
    render(
      <ReservationExpiryWarning
        reservations={[
          makeReservation({
            batchId: "BATCH-HEALTHY",
            asset: "XLM",
            expiresAt: new Date(Date.now() + 30 * MINUTE).toISOString(),
          }),
        ]}
      />,
    );
    expect(screen.getByText("Batch BATCH-HEALTHY")).toBeInTheDocument();
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("flags a reservation that is expiring soon", () => {
    render(
      <ReservationExpiryWarning
        reservations={[
          makeReservation({
            expiresAt: new Date(Date.now() + 2 * MINUTE).toISOString(),
          }),
        ]}
      />,
    );
    expect(screen.getByText("Expiring soon")).toBeInTheDocument();
  });

  it("shows the blocking banner for an expired reservation", () => {
    render(
      <ReservationExpiryWarning
        reservations={[
          makeReservation({
            expiresAt: new Date(Date.now() - MINUTE).toISOString(),
          }),
        ]}
      />,
    );
    expect(
      screen.getByText("Expired reservations block execution"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Expired").length).toBeGreaterThan(0);
  });

  it("disables actions that are not allowed", () => {
    render(
      <ReservationExpiryWarning
        reservations={[
          makeReservation({
            canRefresh: false,
            canRevalidate: false,
            canCancel: false,
          }),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /refresh/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /revalidate/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  it("refreshes an expired reservation back to healthy via the store", () => {
    useReservationsStore.getState().setReservations([
      makeReservation({
        id: "res_x",
        expiresAt: new Date(Date.now() - MINUTE).toISOString(),
        canRefresh: true,
      }),
    ]);

    render(<ReservationExpiryWarning />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    const updated = useReservationsStore.getState().getReservation("res_x")!;
    expect(getReservationStatus(updated)).toBe("healthy");
  });
});
