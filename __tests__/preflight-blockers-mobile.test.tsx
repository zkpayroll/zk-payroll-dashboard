import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PayrollRiskWarnings } from "@/components/features/payroll/PayrollRiskWarnings";

describe("Mobile layout for payroll preflight blockers tests", () => {
  it("renders risk warnings with mobile responsive flex-col sm:flex-row styling", () => {
    const selectedEmployees = [
      { id: "emp_1", name: "Alice", salary: 5000 },
    ];
    const allEmployees = [
      { id: "emp_1", name: "Alice", salary: 5000, address: "INVALID_ADDRESS" },
    ];

    render(
      <PayrollRiskWarnings
        treasuryBalance={100000}
        totalAmount={5000}
        selectedEmployees={selectedEmployees}
        allEmployees={allEmployees}
      />
    );

    const cards = screen.getAllByTestId("preflight-blocker-card");
    expect(cards.length).toBeGreaterThan(0);

    const card = cards[0];
    expect(card.className).toMatch(/flex-col/);
    expect(card.className).toMatch(/sm:flex-row/);
  });

  it("ensures critical blockers maintain high visibility on narrow screens", () => {
    const selectedEmployees = [
      { id: "emp_1", name: "Bob", salary: 10000 },
    ];
    const allEmployees = [
      { id: "emp_1", name: "Bob", salary: 10000, address: "" },
    ];

    render(
      <PayrollRiskWarnings
        treasuryBalance={50000}
        totalAmount={10000}
        selectedEmployees={selectedEmployees}
        allEmployees={allEmployees}
      />
    );

    expect(screen.getByText("Unsupported Asset Configuration")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
