import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollRunDetail from "@/components/features/payroll/PayrollRunDetail";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

it("renders a run after loading without changing the hook order", async () => {
  const { rerender } = render(<PayrollRunDetail />);
  expect(screen.getByLabelText("Loading payroll run details")).toBeInTheDocument();
  rerender(<PayrollRunDetail run={MOCK_PAYROLL_RUNS[0]} />);
  expect(await screen.findByRole("heading", { level: 1, name: /payroll run/i })).toBeInTheDocument();
});
