import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  summarizeSimulation,
  type SimulationCheck,
} from "@/lib/sdk/payrollSimulation";
import PayrollSimulationReview from "@/components/features/simulation/PayrollSimulationReview";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import * as simulationModule from "@/lib/sdk/payrollSimulation";

vi.mock("@/lib/sdk/payrollSimulation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sdk/payrollSimulation")>();
  return {
    ...actual,
    fetchPayrollSimulation: vi.fn(actual.fetchPayrollSimulation),
  };
});

const mockedFetch = vi.mocked(simulationModule.fetchPayrollSimulation);

const RUNS = MOCK_PAYROLL_RUNS;

describe("summarizeSimulation", () => {
  it("rolls up severities and flips canExecute when anything is blocked", () => {
    const checks: SimulationCheck[] = [
      { id: "a", severity: "ready", title: "", description: "" },
      { id: "b", severity: "warning", title: "", description: "" },
      { id: "c", severity: "blocked", title: "", description: "" },
    ];
    const summary = summarizeSimulation(checks);
    expect(summary).toEqual({ ready: 1, warning: 1, blocked: 1, canExecute: false });

    const clean = summarizeSimulation([checks[0]!, checks[1]!]);
    expect(clean.canExecute).toBe(true);
  });
});

describe("PayrollSimulationReview component", () => {
  beforeEach(() => {
    mockedFetch.mockClear();
  });

  it("shows loading state then ready/warning/blocked sections for an unsafe run", async () => {
    render(<PayrollSimulationReview runs={RUNS} />);

    expect(screen.getByTestId("simulation-loading")).toBeInTheDocument();

    // Switch to the pending, unproven run so blockers are present.
    await waitFor(() =>
      expect(screen.queryByTestId("simulation-loading")).not.toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/Payroll run/), {
      target: { value: "tx_003" },
    });
    await waitFor(() =>
      expect(screen.queryByTestId("simulation-loading")).not.toBeInTheDocument(),
    );

    expect(mockedFetch).toHaveBeenCalledWith("tx_003", RUNS);
    expect(screen.getByTestId("simulation-section-blocked")).toBeInTheDocument();
    expect(screen.getByTestId("simulation-verdict")).toHaveTextContent(
      /execution is not safe/i,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    const links = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(links).toContain("/payroll/execute");
  });

  it("keeps private salary values out of the rendered output", async () => {
    render(<PayrollSimulationReview runs={RUNS} />);
    await waitFor(() =>
      expect(screen.queryByTestId("simulation-loading")).not.toBeInTheDocument(),
    );

    const text = document.body.textContent ?? "";
    // Raw salary amounts from the employee directory must never appear.
    expect(text).not.toContain("5000");
    expect(text).toContain("Privacy preserved");
  });

  it("renders the empty state when there are no executable runs", async () => {
    render(<PayrollSimulationReview runs={[]} />);

    await waitFor(() => expect(screen.getByTestId("simulation-empty")).toBeInTheDocument());
    expect(screen.getByText(/Nothing to simulate yet/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when fetching fails", async () => {
    mockedFetch
      .mockRejectedValueOnce(new Error("simulator offline"))
      .mockResolvedValue(null);

    render(<PayrollSimulationReview runs={RUNS} />);
    await waitFor(() => expect(screen.getByTestId("simulation-error")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /retry simulation/i }));
    await waitFor(() => expect(screen.getByTestId("simulation-empty")).toBeInTheDocument());
  });
});
