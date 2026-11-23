/**
 * @vitest-environment jsdom
 *
 * Treasury reservation recovery flow (#889).
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ReservationExpiryWarning from "@/components/features/treasury/ReservationExpiryWarning";
import {
  getReservationStatus,
  useReservationsStore,
  type FundingReservation,
} from "@/stores/reservations";
import {
  RESERVATION_RECOVERY_COPY,
  describeReservationActionResult,
  getReservationRecoveryPlan,
  runReservationRecoveryAction,
  summarizeReservationRecovery,
} from "@/lib/treasury/reservationRecovery";
import {
  getFundingReservationTimeline,
  resetFundingReservationEvents,
} from "@/lib/events/reservationEvents";

const MINUTE = 60 * 1000;
const NOW = Date.parse("2026-11-23T12:00:00Z");

function makeReservation(overrides: Partial<FundingReservation> = {}): FundingReservation {
  return {
    id: "res_1",
    batchId: "BATCH-001",
    asset: "USDC",
    amount: "12500.00",
    reservedAt: new Date(NOW - 20 * MINUTE).toISOString(),
    expiresAt: new Date(NOW + 30 * MINUTE).toISOString(),
    canRefresh: true,
    canCancel: true,
    canRevalidate: true,
    ...overrides,
  };
}

const expired = (o: Partial<FundingReservation> = {}) =>
  makeReservation({ expiresAt: new Date(NOW - MINUTE).toISOString(), ...o });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  useReservationsStore.getState().reset();
  resetFundingReservationEvents();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getReservationRecoveryPlan", () => {
  it("recommends nothing for a healthy reservation", () => {
    const plan = getReservationRecoveryPlan(makeReservation(), NOW);
    expect(plan).toMatchObject({
      status: "healthy",
      recommendation: "none",
      blocksExecution: false,
      requiresAdministrator: false,
    });
  });

  it("recommends Refresh for an expired, renewable reservation", () => {
    const plan = getReservationRecoveryPlan(expired(), NOW);
    expect(plan.recommendation).toBe("refresh");
    expect(plan.blocksExecution).toBe(true);
  });

  it("falls back to Revalidate when Refresh is disabled", () => {
    const plan = getReservationRecoveryPlan(expired({ canRefresh: false }), NOW);
    expect(plan.recommendation).toBe("revalidate");
    expect(plan.actions.refresh).toEqual({
      action: "refresh",
      enabled: false,
      disabledReason: RESERVATION_RECOVERY_COPY.refreshDisabled,
    });
  });

  it("recommends Cancel when an expired lock cannot be renewed", () => {
    const plan = getReservationRecoveryPlan(
      expired({ canRefresh: false, canRevalidate: false }),
      NOW,
    );
    expect(plan.recommendation).toBe("cancel");
    expect(plan.requiresAdministrator).toBe(false);
  });

  it("escalates to an administrator when every action is disabled", () => {
    const plan = getReservationRecoveryPlan(
      expired({ canRefresh: false, canRevalidate: false, canCancel: false }),
      NOW,
    );
    expect(plan.recommendation).toBe("escalate");
    expect(plan.requiresAdministrator).toBe(true);
    expect(plan.actions.cancel.disabledReason).toMatch(/treasury administrator/i);
  });

  it("recommends executing now when a warning lock cannot be extended", () => {
    const plan = getReservationRecoveryPlan(
      makeReservation({
        expiresAt: new Date(NOW + 2 * MINUTE).toISOString(),
        canRefresh: false,
        canRevalidate: false,
      }),
      NOW,
    );
    expect(plan.status).toBe("warning");
    expect(plan.recommendation).toBe("execute");
    expect(plan.blocksExecution).toBe(false);
  });

  it("treats the exact expiry instant as blocking (boundary)", () => {
    const plan = getReservationRecoveryPlan(
      makeReservation({ expiresAt: new Date(NOW).toISOString() }),
      NOW,
    );
    expect(plan.status).toBe("expired");
    expect(plan.blocksExecution).toBe(true);
  });

  it("never offers renewal for a corrupt amount, and steers to Cancel", () => {
    const plan = getReservationRecoveryPlan(makeReservation({ amount: "-5" }), NOW);
    expect(plan.hasCorruptData).toBe(true);
    expect(plan.status).toBe("expired");
    expect(plan.actions.refresh.enabled).toBe(false);
    expect(plan.actions.revalidate.enabled).toBe(false);
    expect(plan.actions.refresh.disabledReason).toBe(RESERVATION_RECOVERY_COPY.renewInvalidData);
    expect(plan.recommendation).toBe("cancel");
  });

  it("allows Refresh to repair a reservation whose only defect is its timestamp", () => {
    const plan = getReservationRecoveryPlan(makeReservation({ expiresAt: "not-a-date" }), NOW);
    expect(plan.hasCorruptData).toBe(true);
    expect(plan.recommendation).toBe("refresh");
  });

  it("fails closed for null input or non-boolean permission flags", () => {
    expect(getReservationRecoveryPlan(null, NOW).recommendation).toBe("escalate");
    const plan = getReservationRecoveryPlan(
      expired({
        canRefresh: "yes" as unknown as boolean,
        canRevalidate: 1 as unknown as boolean,
        canCancel: false,
      }),
      NOW,
    );
    expect(plan.recommendation).toBe("escalate");
  });
});

describe("summarizeReservationRecovery", () => {
  it("counts blocking, self-service and administrator-only reservations", () => {
    const summary = summarizeReservationRecovery(
      [
        makeReservation({ id: "ok" }),
        expired({ id: "a" }),
        expired({ id: "b", canRefresh: false, canRevalidate: false, canCancel: false }),
        null,
      ],
      NOW,
    );
    expect(summary).toEqual({
      total: 4,
      blocking: 3,
      selfServiceRecoverable: 1,
      needsAdministrator: 2,
      canExecutePayroll: false,
    });
  });

  it("allows execution for an empty or invalid list", () => {
    expect(summarizeReservationRecovery([], NOW).canExecutePayroll).toBe(true);
    expect(summarizeReservationRecovery(undefined, NOW).total).toBe(0);
  });
});

describe("store recovery actions return explicit results", () => {
  it("reports success and changes the reservation", () => {
    useReservationsStore.getState().setReservations([expired({ id: "a" })]);
    const result = useReservationsStore.getState().refreshReservation("a");
    expect(result).toEqual({ ok: true, action: "refresh", reservationId: "a" });
    expect(getReservationStatus(useReservationsStore.getState().getReservation("a"))).toBe(
      "healthy",
    );
  });

  it("reports not_permitted and leaves the reservation untouched", () => {
    const r = expired({ id: "a", canRefresh: false, canCancel: false });
    useReservationsStore.getState().setReservations([r]);
    expect(useReservationsStore.getState().refreshReservation("a")).toEqual({
      ok: false,
      action: "refresh",
      reason: "not_permitted",
    });
    expect(useReservationsStore.getState().cancelReservation("a").ok).toBe(false);
    expect(useReservationsStore.getState().getReservation("a")).toEqual(r);
  });

  it("reports not_found and invalid_id", () => {
    expect(useReservationsStore.getState().revalidateReservation("missing")).toMatchObject({
      ok: false,
      reason: "not_found",
    });
    expect(useReservationsStore.getState().cancelReservation("  ")).toMatchObject({
      ok: false,
      reason: "invalid_id",
    });
  });
});

describe("runReservationRecoveryAction", () => {
  it("refuses to renew a reservation with a corrupt amount", () => {
    useReservationsStore
      .getState()
      .setReservations([expired({ id: "bad", amount: "not-money" })]);
    const before = useReservationsStore.getState().getReservation("bad");
    const result = runReservationRecoveryAction("refresh", "bad");
    expect(result).toEqual({ ok: false, action: "refresh", reason: "invalid_data" });
    expect(useReservationsStore.getState().getReservation("bad")).toEqual(before);
  });

  it("still lets the operator cancel a corrupt reservation", () => {
    useReservationsStore
      .getState()
      .setReservations([expired({ id: "bad", asset: "" })]);
    expect(runReservationRecoveryAction("cancel", "bad").ok).toBe(true);
    expect(useReservationsStore.getState().reservations).toHaveLength(0);
  });

  it("records successful recovery on the timeline without amounts", () => {
    useReservationsStore.getState().setReservations([expired({ id: "res_rec" })]);
    runReservationRecoveryAction("revalidate", "res_rec");
    runReservationRecoveryAction("cancel", "res_rec");
    const events = getFundingReservationTimeline("res_rec");
    expect(events.map((e) => e.state).sort()).toEqual(["cancelled", "updated"]);
    events.forEach((e) => {
      expect(e.amount).toBeUndefined();
      expect(e.summary).not.toMatch(/12500|12,500/);
    });
  });

  it("does not record a timeline event for a failed action", () => {
    runReservationRecoveryAction("refresh", "ghost");
    expect(getFundingReservationTimeline("ghost")).toHaveLength(0);
  });
});

describe("describeReservationActionResult", () => {
  it("produces actionable messages for each failure reason", () => {
    const reasons = ["invalid_id", "not_found", "not_permitted", "invalid_data"] as const;
    for (const reason of reasons) {
      const { tone, message } = describeReservationActionResult({
        ok: false,
        action: "refresh",
        reason,
      });
      expect(tone).toBe("error");
      expect(message).toMatch(/^Refresh/);
      expect(message).not.toContain("{action}");
      expect(message).toMatch(/retry|recovery action|administrator|create a new reservation/i);
    }
  });

  it("confirms success with the next step", () => {
    expect(
      describeReservationActionResult({ ok: true, action: "cancel", reservationId: "x" }),
    ).toEqual({ tone: "success", message: RESERVATION_RECOVERY_COPY.success.cancel });
  });
});

describe("ReservationExpiryWarning recovery UI", () => {
  it("highlights the recommended action and announces a successful refresh", () => {
    useReservationsStore.getState().setReservations([expired({ id: "a" })]);
    const onRecoveryAction = vi.fn();
    render(<ReservationExpiryWarning onRecoveryAction={onRecoveryAction} />);

    expect(screen.getByTestId("reservation-recovery-actions-a")).toHaveAttribute(
      "data-recommendation",
      "refresh",
    );
    expect(screen.getByTestId("reservation-refresh-a")).toHaveAttribute(
      "data-recommended",
      "true",
    );
    expect(screen.getByTestId("reservation-recovery-progress")).toHaveTextContent(
      "1 reservation blocks execution: 1 can be recovered here.",
    );

    fireEvent.click(screen.getByTestId("reservation-refresh-a"));

    const outcome = screen.getByTestId("reservation-recovery-outcome");
    expect(outcome).toHaveAttribute("role", "status");
    expect(outcome).toHaveTextContent(RESERVATION_RECOVERY_COPY.success.refresh);
    expect(onRecoveryAction).toHaveBeenCalledWith({
      ok: true,
      action: "refresh",
      reservationId: "a",
    });
    expect(screen.queryByTestId("reservation-recovery-progress")).not.toBeInTheDocument();
  });

  it("explains disabled actions and points to an administrator", () => {
    useReservationsStore
      .getState()
      .setReservations([
        expired({ id: "locked", canRefresh: false, canRevalidate: false, canCancel: false }),
      ]);
    render(<ReservationExpiryWarning />);

    const reasons = screen.getByTestId("reservation-recovery-disabled-locked");
    expect(reasons).toHaveTextContent(RESERVATION_RECOVERY_COPY.refreshDisabled);
    expect(reasons).toHaveTextContent(RESERVATION_RECOVERY_COPY.cancelDisabled);
    expect(screen.getByTestId("reservation-cancel-locked")).toHaveAttribute(
      "aria-describedby",
      "reservation-locked-cancel-disabled-reason",
    );
    expect(screen.getByTestId("reservation-recovery-progress")).toHaveTextContent(
      "0 can be recovered here, 1 needs a treasury administrator",
    );
  });

  it("disables renewal for corrupt amounts and keeps Cancel available", () => {
    useReservationsStore
      .getState()
      .setReservations([makeReservation({ id: "bad", amount: "-1" })]);
    render(<ReservationExpiryWarning />);
    expect(screen.getByTestId("reservation-refresh-bad")).toBeDisabled();
    expect(screen.getByTestId("reservation-revalidate-bad")).toBeDisabled();
    expect(screen.getByTestId("reservation-cancel-bad")).toBeEnabled();

    fireEvent.click(screen.getByTestId("reservation-cancel-bad"));
    expect(screen.getByTestId("reservation-recovery-outcome")).toHaveTextContent(
      RESERVATION_RECOVERY_COPY.success.cancel,
    );
    expect(screen.getByText("No funding reservations found")).toBeInTheDocument();
  });

  it("shows an actionable alert when the reservation is not tracked in the store", () => {
    render(<ReservationExpiryWarning reservations={[expired({ id: "snapshot_only" })]} />);
    fireEvent.click(screen.getByTestId("reservation-refresh-snapshot_only"));
    const outcome = screen.getByTestId("reservation-recovery-outcome");
    expect(outcome).toHaveAttribute("role", "alert");
    expect(outcome).toHaveTextContent(/no longer tracked.*Reload treasury state, then retry/i);
  });

  it("keeps recovery messages free of amounts and private identifiers", () => {
    useReservationsStore
      .getState()
      .setReservations([expired({ id: "a", batchId: "BATCH_emp_42", amount: "98765.43" })]);
    render(<ReservationExpiryWarning />);
    fireEvent.click(screen.getByTestId("reservation-revalidate-a"));
    const text = screen.getByTestId("reservation-recovery-outcome").textContent ?? "";
    expect(text).not.toMatch(/98765|emp_42/);
  });
});
