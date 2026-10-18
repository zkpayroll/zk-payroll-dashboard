/**
 * @vitest-environment jsdom
 *
 * Tests for the treasury replenishment readiness card (issue #617).
 */
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TreasuryReplenishmentReadinessCard from "@/components/features/treasury/TreasuryReplenishmentReadinessCard";
import type { TreasuryReplenishmentSnapshot } from "@/types/treasury";

const BLOCK_POLICY = {
  minReservePercentage: 20,
  minReserveFixedAmount: 25000,
  replenishThresholdPercentage: 15,
  shortfallPolicy: "block",
} as const;

function snapshot(
  overrides: Partial<TreasuryReplenishmentSnapshot> = {},
): TreasuryReplenishmentSnapshot {
  return {
    assetCode: "USDC",
    availableBalance: "45000",
    nextPayrollObligation: "19500",
    policy: BLOCK_POLICY,
    ...overrides,
  };
}

describe("TreasuryReplenishmentReadinessCard", () => {
  it("renders a ready state when the reserve target is met", () => {
    render(<TreasuryReplenishmentReadinessCard snapshot={snapshot()} />);

    const card = screen.getByTestId("treasury-replenishment-readiness");
    expect(card).toHaveAttribute("data-status", "ready");
    expect(card).toHaveAttribute("role", "status");
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByTestId("treasury-replenishment-message")).toHaveTextContent(
      "Available balance meets the policy reserve target of 25,000 USDC.",
    );
    expect(screen.getByText("Recommended top-up").nextElementSibling).toHaveTextContent(
      "None",
    );
    expect(screen.queryByText("Replenish treasury")).not.toBeInTheDocument();
    expect(screen.queryByTestId("treasury-replenishment-shortfall")).not.toBeInTheDocument();
  });

  it("renders a watch state with the recommended top-up", () => {
    render(
      <TreasuryReplenishmentReadinessCard snapshot={snapshot({ availableBalance: "24000" })} />,
    );

    const card = screen.getByTestId("treasury-replenishment-readiness");
    expect(card).toHaveAttribute("data-status", "watch");
    expect(screen.getByText("Below target")).toBeInTheDocument();
    expect(screen.getByTestId("treasury-replenishment-message")).toHaveTextContent(
      "Balance covers payroll but is below the policy reserve target of 25,000 USDC.",
    );
    expect(screen.getByText("Recommended top-up").nextElementSibling).toHaveTextContent(
      "1,000 USDC",
    );
    expect(screen.getByRole("link", { name: "Replenish treasury" })).toHaveAttribute(
      "href",
      "/treasury",
    );
    expect(screen.queryByTestId("treasury-replenishment-shortfall")).not.toBeInTheDocument();
  });

  it("alerts on a payroll shortfall and shows the blocked policy outcome", () => {
    render(
      <TreasuryReplenishmentReadinessCard snapshot={snapshot({ availableBalance: "5000" })} />,
    );

    const card = screen.getByTestId("treasury-replenishment-readiness");
    expect(card).toHaveAttribute("data-status", "replenish_now");
    expect(card).toHaveAttribute("role", "alert");
    expect(screen.getByText("Replenish now")).toBeInTheDocument();
    expect(screen.getByTestId("treasury-replenishment-shortfall")).toHaveTextContent(
      "Shortfall: 14,500 USDC",
    );
    expect(screen.getByTestId("treasury-replenishment-message")).toHaveTextContent(
      "Payroll is blocked by policy until the treasury is replenished.",
    );
    expect(screen.getByRole("link", { name: "Replenish treasury" })).toBeInTheDocument();
    expect(screen.getByText("Available balance").nextElementSibling).toHaveTextContent(
      "5,000 USDC",
    );
  });

  it("alerts below the replenishment threshold without a payroll shortfall", () => {
    render(
      <TreasuryReplenishmentReadinessCard
        snapshot={snapshot({
          availableBalance: "1200",
          nextPayrollObligation: "1000",
          policy: {
            minReservePercentage: 20,
            minReserveFixedAmount: 10000,
            replenishThresholdPercentage: 15,
            shortfallPolicy: "block",
          },
        })}
      />,
    );

    expect(screen.getByTestId("treasury-replenishment-readiness")).toHaveAttribute(
      "data-status",
      "replenish_now",
    );
    expect(screen.getByTestId("treasury-replenishment-message")).toHaveTextContent(
      "below the replenishment threshold of 1,500 USDC",
    );
    expect(screen.queryByTestId("treasury-replenishment-shortfall")).not.toBeInTheDocument();
  });

  it("shows an unavailable state when the balance reading is missing", () => {
    render(
      <TreasuryReplenishmentReadinessCard snapshot={snapshot({ availableBalance: null })} />,
    );

    const card = screen.getByTestId("treasury-replenishment-readiness");
    expect(card).toHaveAttribute("data-status", "error");
    expect(card).toHaveAttribute("role", "alert");
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Replenishment readiness could not be determined.")).toBeInTheDocument();
    expect(screen.getByText(/The treasury balance is unavailable\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review reserve policy" })).toHaveAttribute(
      "href",
      "/settings/payroll-policy",
    );
    expect(screen.queryByText("Recommended top-up")).not.toBeInTheDocument();
  });

  it("shows an unavailable state for a broken reserve policy", () => {
    render(
      <TreasuryReplenishmentReadinessCard
        snapshot={snapshot({
          policy: { ...BLOCK_POLICY, minReservePercentage: 5000 },
        })}
      />,
    );

    expect(screen.getByTestId("treasury-replenishment-readiness")).toHaveAttribute(
      "data-status",
      "error",
    );
    expect(screen.getByText(/min reserve percentage must be a number/)).toBeInTheDocument();
  });

  it("renders from live store state when no snapshot is supplied", () => {
    render(<TreasuryReplenishmentReadinessCard />);

    const card = screen.getByTestId("treasury-replenishment-readiness");
    expect(["ready", "watch", "replenish_now", "error"]).toContain(
      card.getAttribute("data-status"),
    );
    expect(screen.getByText("Treasury replenishment readiness")).toBeInTheDocument();
  });
});
