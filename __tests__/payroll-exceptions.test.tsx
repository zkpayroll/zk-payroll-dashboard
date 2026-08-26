import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PayrollExceptionsQueue from "@/components/features/payroll/PayrollExceptionsQueue";

const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

describe("PayrollExceptionsQueue", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
  });

  it("renders the section heading and tabs", () => {
    render(<PayrollExceptionsQueue />);

    expect(
      screen.getByRole("heading", { name: /payroll exceptions queue/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /transaction exceptions/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /employee exceptions/i }),
    ).toBeInTheDocument();
  });

  it("renders transaction exceptions and labels them accessibly", () => {
    render(<PayrollExceptionsQueue />);

    expect(
      screen.getByRole("tabpanel", { name: /transaction exceptions/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    expect(screen.getByText(/payroll run tx_/i)).toBeInTheDocument();
  });

  it("switches to employee exceptions and resolves an item", () => {
    render(<PayrollExceptionsQueue />);

    fireEvent.click(screen.getByRole("tab", { name: /employee exceptions/i }));

    expect(
      screen.getByRole("tabpanel", { name: /employee exceptions/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Amara Diallo")).toBeInTheDocument();
    expect(screen.getByText("Kofi Boateng")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /activate employee/i }));

    expect(toastSuccess).toHaveBeenCalled();
  });
});
