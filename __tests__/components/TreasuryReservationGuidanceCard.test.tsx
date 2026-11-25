/**
 * @vitest-environment jsdom
 *
 * Component unit tests for TreasuryReservationGuidanceCard (#887).
 */

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import TreasuryReservationGuidanceCard from "@/components/features/treasury/TreasuryReservationGuidanceCard";
import { evaluateTreasuryReservationGuidance } from "@/lib/treasury/reservationGuidance";
import { useReservationsStore, type FundingReservation } from "@/stores/reservations";
import { useTreasuryStore } from "@/stores/treasury";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";

const MINUTE = 60 * 1000;
const FIXED_NOW = 1_700_000_000_000;

function makeReservation(
  overrides: Partial<FundingReservation> = {},
): FundingReservation {
  return {
    id: "res_card_1",
    batchId: "BATCH-CARD-01",
    asset: "USDC",
    amount: "15,000.00",
    reservedAt: new Date(FIXED_NOW - 2 * MINUTE).toISOString(),
    expiresAt: new Date(FIXED_NOW + 13 * MINUTE).toISOString(),
    canRefresh: true,
    canCancel: true,
    canRevalidate: true,
    ...overrides,
  };
}

describe("TreasuryReservationGuidanceCard (#887)", () => {
  beforeEach(() => {
    useReservationsStore.getState().reset();
    useTreasuryStore.getState().reset();
  });

  it("renders blocked alert and asset settings link when payroll assets are unconfigured", () => {
    render(
      <TreasuryReservationGuidanceCard
        reservations={[]}
        availableBalance={45000}
        projectedPayroll={19500}
        hasConfiguredAssets={false}
        now={FIXED_NOW}
      />,
    );

    const card = screen.getByTestId("treasury-reservation-guidance-card");
    expect(card).toHaveAttribute("data-reason", "ASSETS_UNCONFIGURED");
    expect(card).toHaveAttribute("data-tone", "blocked");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("treasury-reservation-remediation-link")).toHaveAttribute(
      "href",
      "/settings/assets",
    );
  });

  it("renders insufficient treasury balance guidance with fund treasury link", () => {
    render(
      <TreasuryReservationGuidanceCard
        reservations={[]}
        availableBalance={1000}
        projectedPayroll={19500}
        now={FIXED_NOW}
      />,
    );

    const card = screen.getByTestId("treasury-reservation-guidance-card");
    expect(card).toHaveAttribute("data-reason", "INSUFFICIENT_TREASURY_BALANCE");
    expect(screen.getByTestId("treasury-reservation-remediation-link")).toHaveAttribute(
      "href",
      "/treasury",
    );
  });

  it("renders expiring-soon warning with status role and execution remediation link", () => {
    render(
      <TreasuryReservationGuidanceCard
        reservations={[
          makeReservation({
            expiresAt: new Date(FIXED_NOW + 2 * MINUTE).toISOString(),
          }),
        ]}
        availableBalance={45000}
        projectedPayroll={19500}
        now={FIXED_NOW}
      />,
    );

    const card = screen.getByTestId("treasury-reservation-guidance-card");
    expect(card).toHaveAttribute("data-reason", "RESERVATION_EXPIRING_SOON");
    expect(card).toHaveAttribute("data-tone", "warning");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByTestId("treasury-reservation-remediation-link")).toHaveAttribute(
      "href",
      "/payroll/execute",
    );
  });

  it("supports direct guidance override prop and renders controls reference without buttons", () => {
    const customGuidance = evaluateTreasuryReservationGuidance({
      reservations: [
        makeReservation({ id: "r1", amount: "30,000.00" }),
        makeReservation({ id: "r2", amount: "20,000.00" }),
      ],
      availableBalance: 45000,
      projectedPayroll: 19500,
      now: FIXED_NOW,
    });

    const { container } = render(
      <TreasuryReservationGuidanceCard guidance={customGuidance} />,
    );

    expect(screen.getByTestId("treasury-reservation-guidance-card")).toHaveAttribute(
      "data-reason",
      "OVER_RESERVATION_BLOCKED",
    );
    expect(screen.getByTestId("treasury-reservation-action-guides")).toBeInTheDocument();
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("isolates non-USDC store lookups and rejects prototype-chain keys safely", () => {
    render(
      <TreasuryReservationGuidanceCard
        reservations={[makeReservation({ asset: "XLM", amount: "5,000.00" })]}
        assetCode="XLM"
        now={FIXED_NOW}
      />,
    );

    // XLM is not configured in default useTreasuryStore (USDC only), so it does NOT borrow USDC's 45,000 balance
    expect(screen.getByTestId("treasury-reservation-guidance-card")).toHaveAttribute(
      "data-reason",
      "OVER_RESERVATION_BLOCKED",
    );

    // Prototype key does not crash or read Object.prototype
    const { container } = render(
      <TreasuryReservationGuidanceCard
        reservations={[]}
        assetCode="__proto__"
        availableBalance={45000}
        projectedPayroll={19500}
        now={FIXED_NOW}
      />,
    );
    const cards = screen.getAllByTestId("treasury-reservation-guidance-card");
    expect(cards[cards.length - 1]).toHaveAttribute(
      "data-reason",
      "UNKNOWN_ASSET_CODE",
    );
    expect(container.textContent).not.toContain("function");
    for (const emp of MOCK_EMPLOYEES) {
      expect(container.textContent).not.toContain(emp.name);
      expect(container.textContent).not.toContain(emp.id);
    }
  });

  it("renders unknown asset code guidance with remediation link (#843)", () => {
    render(
      <TreasuryReservationGuidanceCard
        reservations={[]}
        assetCode="DOGE"
        availableBalance={45000}
        projectedPayroll={19500}
        now={FIXED_NOW}
      />,
    );

    const card = screen.getByTestId("treasury-reservation-guidance-card");
    expect(card).toHaveAttribute("data-reason", "UNKNOWN_ASSET_CODE");
    expect(card).toHaveAttribute("data-tone", "blocked");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Unknown Asset Code "DOGE" Cannot Be Reserved/i)).toBeInTheDocument();
    expect(screen.getByText(/Treasury reservation requires a supported payroll asset/i)).toBeInTheDocument();
    expect(screen.getByTestId("treasury-reservation-remediation-link")).toHaveAttribute(
      "href",
      "/settings/assets",
    );
  });

  it("ignores blank newReservationAmount input instead of flagging false INVALID_TREASURY_DATA", () => {
    render(
      <TreasuryReservationGuidanceCard
        reservations={[makeReservation()]}
        availableBalance={45000}
        projectedPayroll={19500}
        newReservationAmount=""
        now={FIXED_NOW}
      />,
    );

    expect(screen.getByTestId("treasury-reservation-guidance-card")).toHaveAttribute(
      "data-reason",
      "RESERVATIONS_HEALTHY",
    );
  });
});
