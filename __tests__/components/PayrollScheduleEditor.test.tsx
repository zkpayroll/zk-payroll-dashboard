import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import PayrollScheduleEditor from "@/components/features/schedule/PayrollScheduleEditor";
import { useDraftScheduleWindowStore } from "@/stores/draftScheduleWindows";
import type { PayrollTemplate, PayrollLock, PayrollRun } from "@/types/models";

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

const INACTIVE_TEMPLATE: PayrollTemplate = {
  ...ACTIVE_TEMPLATE,
  id: "tpl_inactive",
  name: "Retired Template",
  isActive: false,
};

describe("PayrollScheduleEditor", () => {
  beforeEach(() => {
    useDraftScheduleWindowStore.setState({ drafts: [] });
  });

  it("shows an empty state when there are no active templates", () => {
    render(
      <PayrollScheduleEditor
        templates={[INACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    expect(screen.getByText("No active recurring schedules")).toBeInTheDocument();
  });

  it("renders the calendar and draft form for an active template", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    expect(screen.getByText("Payroll Schedule Editor")).toBeInTheDocument();
    expect(screen.getByLabelText(/recurring template/i)).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: /payroll schedule calendar/i })).toBeInTheDocument();
  });

  it("only lists active templates in the draft form", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE, INACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    const select = screen.getByLabelText(/recurring template/i) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).toContain("Monthly Engineering Payroll");
    expect(optionLabels).not.toContain("Retired Template");
  });

  it("saves a valid draft settlement window and lists it", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-02-01" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-02-10" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));

    expect(screen.getByText("Draft settlement windows")).toBeInTheDocument();
    expect(screen.getByText("2025-02-01 → 2025-02-10")).toBeInTheDocument();
  });

  it("rejects a draft window where start is after end", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-02-10" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-02-01" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/window start must be on or before window end/i);
  });

  it("rejects a draft window that overlaps an existing draft", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-02-01" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-02-10" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));

    fireEvent.change(screen.getByLabelText(/window start/i), { target: { value: "2025-02-05" } });
    fireEvent.change(screen.getByLabelText(/window end/i), { target: { value: "2025-02-15" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft window/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/overlaps with/i);
  });

  it("navigates between months without crashing", () => {
    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={[]}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    const nextButtons = screen.getAllByLabelText(/next month/i);
    fireEvent.click(nextButtons[0]);
    const prevButtons = screen.getAllByLabelText(/previous month/i);
    fireEvent.click(prevButtons[0]);

    expect(screen.getByText("Payroll Schedule Editor")).toBeInTheDocument();
  });

  it("shows unresolved locks on the calendar but not resolved ones", () => {
    const locks: PayrollLock[] = [
      {
        id: "lock_open",
        payrollId: "tx_open",
        reasonType: "manual_freeze",
        reasonDescription: "Manual freeze pending review",
        lockedAt: "2025-01-10T00:00:00Z",
        lockedBy: "admin",
        resolutionAction: "Review and unfreeze",
        isResolved: false,
      },
      {
        id: "lock_resolved",
        payrollId: "tx_resolved",
        reasonType: "manual_freeze",
        reasonDescription: "Old resolved freeze",
        lockedAt: "2025-01-12T00:00:00Z",
        lockedBy: "admin",
        resolutionAction: "n/a",
        isResolved: true,
      },
    ];

    render(
      <PayrollScheduleEditor
        templates={[ACTIVE_TEMPLATE]}
        locks={locks}
        runs={[]}
        initialViewDate={new Date(Date.UTC(2025, 0, 1))}
      />,
    );

    expect(screen.getAllByTitle("Manual freeze pending review").length).toBeGreaterThan(0);
    expect(screen.queryByTitle("Old resolved freeze")).not.toBeInTheDocument();
  });
});
