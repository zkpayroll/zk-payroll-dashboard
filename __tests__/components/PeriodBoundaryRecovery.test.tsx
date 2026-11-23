import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import PayrollScheduleEditor from "@/components/features/schedule/PayrollScheduleEditor";
import { useDraftScheduleWindowStore } from "@/stores/draftScheduleWindows";
import type { PayrollTemplate } from "@/types/models";

const ACTIVE_TEMPLATE: PayrollTemplate = {
  id: "tpl_active",
  companyId: "company_001",
  name: "Monthly Engineering Payroll",
  description: "",
  frequency: "monthly",
  employeeIds: ["emp_001"],
  dayOfMonth: 15,
  isActive: true,
  lastExecuted: null,
  nextScheduled: "2025-01-15T09:00:00Z",
  createdAt: "2024-06-01T00:00:00Z",
  updatedAt: "2024-06-01T00:00:00Z",
  createdBy: "test",
};

const SECOND_TEMPLATE: PayrollTemplate = {
  ...ACTIVE_TEMPLATE,
  id: "tpl_second",
  name: "Biweekly Contractor Payroll",
  frequency: "biweekly",
  dayOfMonth: undefined,
  nextScheduled: "2025-01-20T09:00:00Z",
};

describe("PayrollScheduleEditor - Period Boundary Recovery Flow", () => {
  beforeEach(() => {
    useDraftScheduleWindowStore.setState({ drafts: [] });
  });

  it("surfaces boundary recovery controls when end date falls before start date", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-02-15" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-02-01" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/period end must be on or after the start date/i);

    const recoveryControls = screen.getByTestId("period-boundary-recovery-controls");
    expect(recoveryControls).toBeInTheDocument();
    expect(recoveryControls).toHaveTextContent(/Swap Start and End Dates/i);
    expect(screen.getByTestId("recovery-action-swap_dates")).toBeInTheDocument();
  });

  it("recovers from inverted boundaries via one-click date swap", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    const startInput = screen.getByLabelText(/window start/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/window end/i) as HTMLInputElement;

    fireEvent.change(startInput, { target: { value: "2025-02-20" } });
    fireEvent.change(endInput, { target: { value: "2025-02-05" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));

    expect(screen.getByTestId("period-boundary-recovery-controls")).toBeInTheDocument();

    // Click the Swap recovery action
    fireEvent.click(screen.getByTestId("recovery-action-swap_dates"));

    // Inputs should now be swapped and chronological
    expect(startInput.value).toBe("2025-02-05");
    expect(endInput.value).toBe("2025-02-20");

    // Error should be cleared
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Saving now succeeds
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));
    expect(screen.getByText("2025-02-05 → 2025-02-20")).toBeInTheDocument();
  });

  it("surfaces shift_next_available recovery when window overlaps with an existing draft", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    // Save initial window
    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-03-01" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-03-10" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));
    expect(screen.getByText("2025-03-01 → 2025-03-10")).toBeInTheDocument();

    // Attempt overlapping window
    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-03-05" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-03-15" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/overlaps with/i);

    const shiftBtn = screen.getByTestId("recovery-action-shift_next_available");
    expect(shiftBtn).toBeInTheDocument();

    // Click shift action to move past March 10
    fireEvent.click(shiftBtn);

    const startInput = screen.getByLabelText(/window start/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/window end/i) as HTMLInputElement;

    // Shifted window should start on 2025-03-11
    expect(startInput.value).toBe("2025-03-11");
    expect(endInput.value).toBe("2025-03-21");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Now save succeeds
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));
    expect(screen.getByText("2025-03-11 → 2025-03-21")).toBeInTheDocument();
  });

  it("allows clearing conflicting drafts via recovery controls", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    // Add first window
    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-04-01" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-04-15" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));
    expect(screen.getByText("2025-04-01 → 2025-04-15")).toBeInTheDocument();

    // Add overlapping window
    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-04-10" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-04-20" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));

    expect(screen.getByTestId("recovery-action-clear_conflicts")).toBeInTheDocument();

    // Click clear conflicts
    fireEvent.click(screen.getByTestId("recovery-action-clear_conflicts"));

    // Old conflicting draft should be removed from the store
    expect(screen.queryByText("2025-04-01 → 2025-04-15")).not.toBeInTheDocument();

    // Now saving the new window succeeds
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));
    expect(screen.getByText("2025-04-10 → 2025-04-20")).toBeInTheDocument();
  });

  it("announces recovery actions to assistive technologies via polite live region", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-05-20" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-05-10" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));

    fireEvent.click(screen.getByTestId("recovery-action-swap_dates"));

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveTextContent(/Applied recovery/i);
  });
});
