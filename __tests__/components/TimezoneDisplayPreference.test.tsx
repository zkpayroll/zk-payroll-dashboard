import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import TimezoneDisplayPreference from "@/components/timezone/TimezoneDisplayPreference";
import { useTimezonePreferenceStore } from "@/stores/timezonePreference";

describe("TimezoneDisplayPreference", () => {
  beforeEach(() => {
    useTimezonePreferenceStore.setState({
      mode: "utc",
      organizationTimeZone: "UTC",
      validationError: null,
    });
  });

  it("defaults to UTC and previews the sample time in UTC", () => {
    render(<TimezoneDisplayPreference />);

    expect(screen.getByRole("radio", { name: /utc/i })).toBeChecked();
    expect(screen.getByTestId("timezone-preview").textContent).toContain("2:30 PM UTC");
  });

  it("switches the preview to the organization timezone", () => {
    render(<TimezoneDisplayPreference />);

    fireEvent.change(screen.getByLabelText(/organization timezone/i), {
      target: { value: "Europe/Berlin" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /organization time/i }));

    const preview = screen.getByTestId("timezone-preview").textContent ?? "";
    expect(preview).toContain("3:30 PM");
    expect(preview).toContain("GMT+1");
    expect(useTimezonePreferenceStore.getState().mode).toBe("organization");
  });

  it("blocks organization mode with an actionable error when the organization zone is invalid (failure path)", () => {
    useTimezonePreferenceStore.setState({ organizationTimeZone: "Bad/Zone" });
    render(<TimezoneDisplayPreference />);

    fireEvent.click(screen.getByRole("radio", { name: /organization time/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/set an organization timezone/i);
    expect(screen.getByRole("radio", { name: /utc/i })).toBeChecked();
  });

  it("warns that display falls back to UTC with invalid persisted data (edge case)", () => {
    useTimezonePreferenceStore.setState({
      mode: "organization",
      organizationTimeZone: "Bad/Zone",
    });
    render(<TimezoneDisplayPreference />);

    expect(screen.getByText(/falling back to UTC/i)).toBeInTheDocument();
    expect(screen.getByTestId("timezone-preview").textContent).toContain("UTC");
  });

  it("keeps local mode selectable and the preview rendered", () => {
    render(<TimezoneDisplayPreference />);

    fireEvent.click(screen.getByRole("radio", { name: /my local time/i }));

    expect(useTimezonePreferenceStore.getState().mode).toBe("local");
    // Local mode's date depends on the host zone, so assert the clock rendered.
    expect(screen.getByTestId("timezone-preview").textContent).toMatch(/\d{1,2}:\d{2} [AP]M/);
  });
});
