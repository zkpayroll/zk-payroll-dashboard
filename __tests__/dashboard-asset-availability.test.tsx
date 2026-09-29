import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardAssetAvailabilityCheck from "@/components/features/dashboard/DashboardAssetAvailabilityCheck";

describe("DashboardAssetAvailabilityCheck", () => {
  it("reports availability when a supported payroll asset is configured", () => {
    render(<DashboardAssetAvailabilityCheck configuredAssets={[{ code: "usdc" }]} />);

    const badge = screen.getByTestId("dashboard-asset-availability");
    expect(badge).toHaveAttribute("data-status", "available");
    expect(badge).toHaveAttribute("data-can-execute", "true");
    expect(screen.getByText(/Supported payroll assets are configured/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Configure payroll assets/i })).not.toBeInTheDocument();
  });

  it("blocks safely and gives an action when assets are missing", () => {
    render(<DashboardAssetAvailabilityCheck configuredAssets={[]} />);

    const badge = screen.getByTestId("dashboard-asset-availability");
    expect(badge).toHaveAttribute("data-status", "unavailable");
    expect(badge).toHaveAttribute("data-can-execute", "false");
    expect(screen.getByText(/Payroll creation is blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configure payroll assets/i })).toHaveAttribute(
      "href",
      "/settings/assets",
    );
  });

  it("ignores unsupported assets, explains them, and handles unknown configuration safely", () => {
    const { rerender } = render(
      <DashboardAssetAvailabilityCheck configuredAssets={[{ code: "FAKE" }]} />,
    );

    expect(screen.getByTestId("dashboard-asset-availability")).toHaveAttribute(
      "data-status",
      "unavailable",
    );
    expect(screen.getByText(/Unsupported assets ignored: FAKE/i)).toBeInTheDocument();

    rerender(<DashboardAssetAvailabilityCheck configuredAssets={null} />);
    expect(screen.getByTestId("dashboard-asset-availability")).toHaveAttribute(
      "data-status",
      "unavailable",
    );
    expect(screen.getByRole("link", { name: /Configure payroll assets/i })).toBeInTheDocument();
  });

  it("surfaces a warning notice when supported and unsupported assets are both configured", () => {
    render(
      <DashboardAssetAvailabilityCheck
        configuredAssets={[{ code: "USDC" }, { code: "BTC" }]}
      />,
    );

    const badge = screen.getByTestId("dashboard-asset-availability");
    expect(badge).toHaveAttribute("data-status", "warning");
    expect(badge).toHaveAttribute("data-can-execute", "true");
    expect(screen.getByText(/Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Unsupported assets ignored: BTC/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configure payroll assets/i })).toBeInTheDocument();
  });

  it("calls onConfigureClick callback when the configure link is clicked", () => {
    const handleConfigure = vi.fn();
    render(
      <DashboardAssetAvailabilityCheck
        configuredAssets={[]}
        onConfigureClick={handleConfigure}
      />,
    );

    const link = screen.getByRole("link", { name: /Configure payroll assets/i });
    fireEvent.click(link);
    expect(handleConfigure).toHaveBeenCalledTimes(1);
  });

  it("falls back to default store configuration when configuredAssets prop is omitted", () => {
    render(<DashboardAssetAvailabilityCheck />);

    const badge = screen.getByTestId("dashboard-asset-availability");
    expect(badge).toBeInTheDocument();
    // Treasury store has default USDC balance, so it should report available
    expect(badge).toHaveAttribute("data-status", "available");
    expect(badge).toHaveAttribute("data-can-execute", "true");
  });

  it("has accessible landmarks and headings", () => {
    render(<DashboardAssetAvailabilityCheck configuredAssets={[{ code: "XLM" }]} />);

    const section = screen.getByRole("status");
    expect(section).toHaveAttribute(
      "aria-labelledby",
      "dashboard-asset-availability-heading",
    );
    expect(
      screen.getByRole("heading", { name: /Payroll asset availability/i, level: 3 }),
    ).toBeInTheDocument();
  });
});
