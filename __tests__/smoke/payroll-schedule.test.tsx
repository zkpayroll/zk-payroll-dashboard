import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import PayrollCalendar from "@/components/features/payroll/PayrollCalendar";
import {
  MOCK_PAYROLL_RUNS,
  MOCK_PAYROLL_RUNS_EMPTY,
  MOCK_PAYROLL_RUNS_FIRST_RUN,
} from "@/lib/api/mockData";

describe("Payroll Schedule", () => {
  it("renders empty state when no payroll runs exist", () => {
    render(<PayrollCalendar runs={MOCK_PAYROLL_RUNS_EMPTY} />);

    expect(screen.getByText("No payroll runs yet")).toBeInTheDocument();
    expect(
      screen.getByText(/When you schedule your first payroll run/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /start first payroll run/i }),
    ).toHaveAttribute("href", "/payroll/execute");
  });

  it("renders first-run state with hero and getting started guidance", () => {
    render(<PayrollCalendar runs={MOCK_PAYROLL_RUNS_FIRST_RUN} />);

    expect(screen.getByText("Next payroll run")).toBeInTheDocument();
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(
      screen.getByText(/Your first payroll run is on the calendar/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Past payroll runs")).not.toBeInTheDocument();
  });

  it("prioritizes the nearest upcoming run in the hero", () => {
    render(<PayrollCalendar runs={MOCK_PAYROLL_RUNS} />);

    const hero = screen.getByText("Next payroll run").closest("article");
    expect(hero).toBeTruthy();
    expect(within(hero!).getByText(/Mar 31, 2025|3\/31\/2025/)).toBeInTheDocument();
  });

  it("shows past payroll runs for the default mock dataset", () => {
    render(<PayrollCalendar runs={MOCK_PAYROLL_RUNS} />);

    expect(screen.getByText("Past payroll runs")).toBeInTheDocument();
  });

  it("links each run to its detail page", () => {
    render(<PayrollCalendar runs={MOCK_PAYROLL_RUNS} />);

    expect(screen.getByRole("link", { name: /view details/i })).toHaveAttribute(
      "href",
      "/payroll/tx_003",
    );
  });

  it("uses distinct scheduled and completed styling labels", () => {
    render(<PayrollCalendar runs={MOCK_PAYROLL_RUNS} />);

    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
  });

  it("renders mobile timeline on narrow layout markup", () => {
    render(<PayrollCalendar runs={MOCK_PAYROLL_RUNS} />);

    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByText(/Tap a run for details/i)).toBeInTheDocument();
  });

  it("renders month calendar grid on desktop markup", () => {
    render(<PayrollCalendar runs={MOCK_PAYROLL_RUNS} />);

    expect(screen.getByRole("grid", { name: /payroll calendar/i })).toBeInTheDocument();
  });

  it("allows switching months via prev and next buttons", () => {
    render(<PayrollCalendar runs={MOCK_PAYROLL_RUNS} />);

    // Get the next upcoming run to determine the initial month
    // From mock data, next upcoming is around Mar 31, 2025
    const initialMonthHeader = screen.getByRole("heading", { level: 3, name: /March/i });
    const initialText = initialMonthHeader.textContent;
    expect(initialText).toMatch(/March/i);

    const prevButton = screen.getByRole("button", { name: /previous month/i });
    const nextButton = screen.getByRole("button", { name: /next month/i });

    // Switch to previous month (February)
    fireEvent.click(prevButton);
    expect(initialMonthHeader.textContent).toMatch(/February/i);

    // Switch to next month twice (March then April)
    fireEvent.click(nextButton);
    expect(initialMonthHeader.textContent).toMatch(/March/i);
    fireEvent.click(nextButton);
    expect(initialMonthHeader.textContent).toMatch(/April/i);
  });
});

