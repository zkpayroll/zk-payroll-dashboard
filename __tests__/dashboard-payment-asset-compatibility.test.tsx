/**
 * Tests for DashboardPaymentAssetCompatibilityCheck (#626).
 *
 * Covers the success (compatible), failure (incompatible), and warning states,
 * the remediation link callback, accessibility landmarks, and the demo
 * fallback when the paymentTargets prop is omitted.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardPaymentAssetCompatibilityCheck from "@/components/features/dashboard/DashboardPaymentAssetCompatibilityCheck";

const USDC_ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const OTHER_ISSUER =
  "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";

describe("DashboardPaymentAssetCompatibilityCheck", () => {
  it("reports a compatible (Ready) state for consistent supported assets", () => {
    render(
      <DashboardPaymentAssetCompatibilityCheck
        paymentTargets={[
          { employeeId: "e1", assetCode: "USDC", assetIssuer: USDC_ISSUER },
          { employeeId: "e2", assetCode: "XLM" },
        ]}
      />,
    );

    const panel = screen.getByTestId("dashboard-payment-asset-compatibility");
    expect(panel).toHaveAttribute("data-status", "compatible");
    expect(panel).toHaveAttribute("data-can-run-payroll", "true");
    expect(
      screen.getByText(/use compatible, supported assets/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /review payroll asset settings/i }),
    ).not.toBeInTheDocument();
  });

  it("blocks and explains when the same code has conflicting issuers", () => {
    render(
      <DashboardPaymentAssetCompatibilityCheck
        paymentTargets={[
          { employeeId: "e1", assetCode: "USDC", assetIssuer: USDC_ISSUER },
          { employeeId: "e2", assetCode: "USDC", assetIssuer: OTHER_ISSUER },
        ]}
      />,
    );

    const panel = screen.getByTestId("dashboard-payment-asset-compatibility");
    expect(panel).toHaveAttribute("data-status", "incompatible");
    expect(panel).toHaveAttribute("data-can-run-payroll", "false");
    expect(screen.getByText(/different issuer accounts/i)).toBeInTheDocument();
    expect(screen.getByText(/Action Required/)).toBeInTheDocument();
  });

  it("shows a Notice warning when supported and unsupported assets are mixed", () => {
    render(
      <DashboardPaymentAssetCompatibilityCheck
        paymentTargets={[{ assetCode: "USDC" }, { assetCode: "DOGE" }]}
      />,
    );

    const panel = screen.getByTestId("dashboard-payment-asset-compatibility");
    expect(panel).toHaveAttribute("data-status", "warning");
    expect(panel).toHaveAttribute("data-can-run-payroll", "true");
    expect(screen.getByText(/Notice/)).toBeInTheDocument();
    expect(screen.getByText(/Unsupported assets ignored: DOGE/i)).toBeInTheDocument();
  });

  it("blocks with an actionable remediation link when no targets are assigned", () => {
    render(<DashboardPaymentAssetCompatibilityCheck paymentTargets={[]} />);

    const panel = screen.getByTestId("dashboard-payment-asset-compatibility");
    expect(panel).toHaveAttribute("data-status", "incompatible");
    expect(panel).toHaveAttribute("data-can-run-payroll", "false");

    const link = screen.getByRole("link", {
      name: /review payroll asset settings/i,
    });
    expect(link).toHaveAttribute("href", "/settings/assets");
  });

  it("calls onReviewClick when the remediation link is activated", () => {
    const onReviewClick = vi.fn();
    render(
      <DashboardPaymentAssetCompatibilityCheck
        paymentTargets={[]}
        onReviewClick={onReviewClick}
      />,
    );

    fireEvent.click(
      screen.getByRole("link", { name: /review payroll asset settings/i }),
    );
    expect(onReviewClick).toHaveBeenCalledTimes(1);
  });

  it("falls back to a healthy demo set when paymentTargets is omitted", () => {
    render(<DashboardPaymentAssetCompatibilityCheck />);

    const panel = screen.getByTestId("dashboard-payment-asset-compatibility");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("data-status", "compatible");
    expect(panel).toHaveAttribute("data-can-run-payroll", "true");
  });

  it("has an accessible status landmark and labelled heading", () => {
    render(<DashboardPaymentAssetCompatibilityCheck paymentTargets={[]} />);

    const section = screen.getByRole("status");
    expect(section).toHaveAttribute(
      "aria-labelledby",
      "dashboard-payment-asset-compatibility-heading",
    );
    expect(
      screen.getByRole("heading", { name: /payment asset compatibility/i }),
    ).toBeInTheDocument();
  });
});
