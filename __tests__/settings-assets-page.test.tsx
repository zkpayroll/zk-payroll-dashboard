import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SettingsAssetsPage from "@/components/features/assets/SettingsAssetsPage";

describe("SettingsAssetsPage", () => {
  it("shows the loading state before resolving the asset allowlist", async () => {
    render(<SettingsAssetsPage />);

    expect(screen.getByText(/loading payroll assets/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/USDC/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
  });

  it("shows an explanatory empty state when no assets are configured", async () => {
    render(<SettingsAssetsPage configuredAssets={[]} />);

    expect(
      await screen.findByText(/No payroll assets configured/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Payroll batches cannot be created/i).length,
    ).toBeGreaterThan(0);
  });

  it("includes a refresh control without mutation controls", async () => {
    render(<SettingsAssetsPage />);

    expect(
      await screen.findByRole("button", { name: /refresh/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add asset/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove asset/i }),
    ).not.toBeInTheDocument();
  });
});
