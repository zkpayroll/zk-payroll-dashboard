/**
 * @vitest-environment jsdom
 *
 * Tests for the payroll period boundary preview (issue #618).
 */
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollBoundaryPreview from "@/components/timezone/PayrollBoundaryPreview";

describe("PayrollBoundaryPreview", () => {
  it("shows a matching UTC window without any date shift", () => {
    const { container } = render(<PayrollBoundaryPreview timeZone="UTC" />);

    const preview = screen.getByTestId("payroll-boundary-preview");
    expect(preview).toHaveAttribute("data-valid", "true");
    expect(preview).toHaveAttribute("data-shifted", "false");

    expect(screen.getByTestId("payroll-boundary-utc")).toHaveTextContent(
      "2026-01-15 2026-01-31",
    );
    expect(screen.getByTestId("payroll-boundary-zone")).toHaveTextContent(
      "2026-01-15 2026-01-31",
    );
    expect(screen.getByTestId("payroll-boundary-note")).toHaveTextContent(
      "Calendar-day boundaries match UTC, so no date shifts at either edge.",
    );
    expect(screen.getByTestId("payroll-boundary-note")).toHaveTextContent(
      "Stored UTC timestamps are unchanged; only the displayed dates follow the selected timezone.",
    );
    expect(container.querySelector('[data-testid="payroll-boundary-error"]')).toBeNull();
  });

  it("surfaces a boundary that shifted into the next local day", () => {
    render(
      <PayrollBoundaryPreview
        startUtc="2026-01-14T23:30:00Z"
        endUtc="2026-01-15T10:00:00Z"
        timeZone="Africa/Lagos"
      />,
    );

    const preview = screen.getByTestId("payroll-boundary-preview");
    expect(preview).toHaveAttribute("data-valid", "true");
    expect(preview).toHaveAttribute("data-shifted", "true");

    expect(screen.getByTestId("payroll-boundary-utc")).toHaveTextContent(
      "2026-01-14 2026-01-15",
    );
    expect(screen.getByTestId("payroll-boundary-zone")).toHaveTextContent(
      "2026-01-15 2026-01-15",
    );
    expect(screen.getByText("Date shifts at boundary")).toBeInTheDocument();
    expect(screen.getByTestId("payroll-boundary-note")).toHaveTextContent(
      "The window opens on 2026-01-14 in UTC, which is already 2026-01-15 in Africa/Lagos.",
    );
  });

  it("surfaces a boundary that is still on the previous local day", () => {
    render(
      <PayrollBoundaryPreview
        startUtc="2026-01-15T02:00:00Z"
        endUtc="2026-01-16T04:00:00Z"
        timeZone="America/New_York"
      />,
    );

    expect(screen.getByTestId("payroll-boundary-preview")).toHaveAttribute(
      "data-shifted",
      "true",
    );
    expect(screen.getByTestId("payroll-boundary-utc")).toHaveTextContent(
      "2026-01-15 2026-01-16",
    );
    expect(screen.getByTestId("payroll-boundary-zone")).toHaveTextContent(
      "2026-01-14 2026-01-15",
    );
  });

  it("renders an error state for an invalid timezone", () => {
    render(<PayrollBoundaryPreview timeZone="Not/AZone" />);

    const preview = screen.getByTestId("payroll-boundary-preview");
    expect(preview).toHaveAttribute("data-valid", "false");
    expect(screen.getByTestId("payroll-boundary-error")).toHaveTextContent(
      /not a valid IANA timezone/,
    );
    expect(screen.queryByTestId("payroll-boundary-utc")).not.toBeInTheDocument();
    expect(screen.queryByTestId("payroll-boundary-zone")).not.toBeInTheDocument();
  });

  it("renders an error state for an unparseable window", () => {
    render(
      <PayrollBoundaryPreview startUtc="whenever" timeZone="UTC" />,
    );

    expect(screen.getByTestId("payroll-boundary-preview")).toHaveAttribute(
      "data-valid",
      "false",
    );
    expect(screen.getByTestId("payroll-boundary-error")).toHaveTextContent(
      /not a valid date/,
    );
  });
});
