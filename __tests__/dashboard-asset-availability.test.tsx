import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardAssetAvailabilityCheck from "@/components/features/dashboard/DashboardAssetAvailabilityCheck";

describe("DashboardAssetAvailabilityCheck", () => {
  it("reports availability when a supported payroll asset is configured", () => {
    render(<DashboardAssetAvailabilityCheck configuredAssets={[{ code: "usdc" }]} />);

    expect(screen.getByTestId("dashboard-asset-availability")).toHaveAttribute("data-status", "available");
    expect(screen.getByText(/Supported payroll assets are configured/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Configure payroll assets/i })).not.toBeInTheDocument();
  });

  it("blocks safely and gives an action when assets are missing", () => {
    render(<DashboardAssetAvailabilityCheck configuredAssets={[]} />);

    expect(screen.getByTestId("dashboard-asset-availability")).toHaveAttribute("data-status", "unavailable");
    expect(screen.getByText(/Payroll creation is blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configure payroll assets/i })).toHaveAttribute("href", "/settings/assets");
  });

  it("ignores unsupported assets, explains them, and handles unknown configuration safely", () => {
    const { rerender } = render(
      <DashboardAssetAvailabilityCheck configuredAssets={[{ code: "FAKE" }]} />,
    );

    expect(screen.getByTestId("dashboard-asset-availability")).toHaveAttribute("data-status", "unavailable");
    expect(screen.getByText(/Unsupported assets ignored: FAKE/i)).toBeInTheDocument();

    rerender(<DashboardAssetAvailabilityCheck configuredAssets={null} />);
    expect(screen.getByTestId("dashboard-asset-availability")).toHaveAttribute("data-status", "unavailable");
    expect(screen.getByRole("link", { name: /Configure payroll assets/i })).toBeInTheDocument();
  });
});
