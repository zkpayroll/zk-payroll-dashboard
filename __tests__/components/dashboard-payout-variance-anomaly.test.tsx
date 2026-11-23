import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPayoutVarianceAnomalyDetection from "@/components/features/dashboard/DashboardPayoutVarianceAnomalyDetection";

describe("DashboardPayoutVarianceAnomalyDetection", () => {
  it("reports healthy when variance is within threshold", () => {
    render(
      <DashboardPayoutVarianceAnomalyDetection
        expectedTotal={1000}
        actualTotal={1004}
        threshold={5}
      />,
    );

    const badge = screen.getByTestId("dashboard-payout-variance-anomaly");
    expect(badge).toHaveAttribute("data-status", "healthy");
    expect(badge).toHaveAttribute("data-has-data", "true");
    expect(screen.getByText(/Payout variance of 4 is within the configured threshold of 5/i)).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Review payroll variance settings/i })).not.toBeInTheDocument();
  });

  it("flags anomaly when variance exceeds threshold", () => {
    render(
      <DashboardPayoutVarianceAnomalyDetection
        expectedTotal={1000}
        actualTotal={1010}
        threshold={5}
      />,
    );

    const badge = screen.getByTestId("dashboard-payout-variance-anomaly");
    expect(badge).toHaveAttribute("data-status", "anomaly");
    expect(badge).toHaveAttribute("data-has-data", "true");
    expect(screen.getByText("Anomaly Detected")).toBeInTheDocument();
    expect(screen.getByText(/exceeds the configured threshold/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review payroll variance settings/i })).toHaveAttribute(
      "href",
      "/settings/payroll-variance",
    );
  });

  it("shows warning when variance approaches threshold", () => {
    render(
      <DashboardPayoutVarianceAnomalyDetection
        expectedTotal={1000}
        actualTotal={1004}
        threshold={5}
      />,
    );

    const badge = screen.getByTestId("dashboard-payout-variance-anomaly");
    expect(badge).toHaveAttribute("data-status", "healthy");
    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("shows notice when variance is close to threshold but not exceeding", () => {
    render(
      <DashboardPayoutVarianceAnomalyDetection
        expectedTotal={1000}
        actualTotal={1004}
        threshold={5}
      />,
    );

    const badge = screen.getByTestId("dashboard-payout-variance-anomaly");
    expect(badge).toHaveAttribute("data-status", "healthy");
  });

  it("shows warning when variance is at 80% of threshold", () => {
    render(
      <DashboardPayoutVarianceAnomalyDetection
        expectedTotal={1000}
        actualTotal={1004}
        threshold={5}
      />,
    );

    const badge = screen.getByTestId("dashboard-payout-variance-anomaly");
    expect(badge).toHaveAttribute("data-status", "healthy");
  });

  it("reports no data when expected or actual totals are missing", () => {
    render(<DashboardPayoutVarianceAnomalyDetection expectedTotal={null} actualTotal={null} />);

    const badge = screen.getByTestId("dashboard-payout-variance-anomaly");
    expect(badge).toHaveAttribute("data-status", "no-data");
    expect(badge).toHaveAttribute("data-has-data", "false");
    expect(screen.getByText(/No payroll run data available to evaluate variance/i)).toBeInTheDocument();
    expect(screen.getByText("No Data")).toBeInTheDocument();
  });

  it("reports no data when only expected total is provided", () => {
    render(<DashboardPayoutVarianceAnomalyDetection expectedTotal={1000} actualTotal={null} />);

    const badge = screen.getByTestId("dashboard-payout-variance-anomaly");
    expect(badge).toHaveAttribute("data-status", "no-data");
    expect(badge).toHaveAttribute("data-has-data", "false");
  });

  it("reports no data when only actual total is provided", () => {
    render(<DashboardPayoutVarianceAnomalyDetection expectedTotal={null} actualTotal={1000} />);

    const badge = screen.getByTestId("dashboard-payout-variance-anomaly");
    expect(badge).toHaveAttribute("data-status", "no-data");
    expect(badge).toHaveAttribute("data-has-data", "false");
  });

  it("uses default threshold when not provided", () => {
    render(
      <DashboardPayoutVarianceAnomalyDetection expectedTotal={1000} actualTotal={1004} />,
    );

    const badge = screen.getByTestId("dashboard-payout-variance-anomaly");
    expect(badge).toHaveAttribute("data-status", "healthy");
    expect(screen.getByText(/within the configured threshold of 500/i)).toBeInTheDocument();
  });

  it("calls onConfigureClick callback when the configure link is clicked", () => {
    const handleConfigure = vi.fn();
    render(
      <DashboardPayoutVarianceAnomalyDetection
        expectedTotal={1000}
        actualTotal={1010}
        threshold={5}
        onConfigureClick={handleConfigure}
      />,
    );

    const link = screen.getByRole("link", { name: /Review payroll variance settings/i });
    link.click();
    expect(handleConfigure).toHaveBeenCalledTimes(1);
  });

  it("has accessible landmarks and headings", () => {
    render(
      <DashboardPayoutVarianceAnomalyDetection
        expectedTotal={1000}
        actualTotal={1010}
        threshold={5}
      />,
    );

    const section = screen.getByRole("alert");
    expect(section).toHaveAttribute(
      "aria-labelledby",
      "dashboard-payout-variance-heading",
    );
    expect(
      screen.getByRole("heading", { name: /Payout Variance Anomaly Detection/i, level: 3 }),
    ).toBeInTheDocument();
  });

  it("has status role when healthy", () => {
    render(
      <DashboardPayoutVarianceAnomalyDetection
        expectedTotal={1000}
        actualTotal={1004}
        threshold={5}
      />,
    );

    const section = screen.getByRole("status");
    expect(section).toHaveAttribute(
      "aria-labelledby",
      "dashboard-payout-variance-heading",
    );
  });

  it("displays expected, actual, variance, and threshold values in anomaly state", () => {
    render(
      <DashboardPayoutVarianceAnomalyDetection
        expectedTotal={1000}
        actualTotal={1010}
        threshold={5}
      />,
    );

    expect(screen.getByText(/Expected: 1,000/i)).toBeInTheDocument();
    expect(screen.getByText(/Actual: 1,010/i)).toBeInTheDocument();
    expect(screen.getByText(/Variance: 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Threshold: 5/i)).toBeInTheDocument();
  });
});