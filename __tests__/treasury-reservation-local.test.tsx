import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TreasuryReservation from "@/components/features/treasury/TreasuryReservation";
import {
  createIdleReservation,
  formatReservationAmount,
  releaseTreasuryReservation,
  updateTreasuryReservation,
} from "@/lib/treasury/reservation";

const BALANCE = 45_000;
const PROJECTED_PAYROLL = 19_500;

describe("treasury reservation helpers", () => {
  it("reserves the aggregate projected payroll amount", () => {
    const result = updateTreasuryReservation({
      balance: BALANCE,
      amount: PROJECTED_PAYROLL,
    });

    expect(result.status).toBe("active");
    expect(result.reservedAmount).toBe(PROJECTED_PAYROLL);
    expect(result.availableAmount).toBe(BALANCE - PROJECTED_PAYROLL);
    expect(result.message).toMatch(/reserved for the next payroll run/i);
  });

  it("preserves an existing reservation when an update fails", () => {
    const result = updateTreasuryReservation({
      balance: 1_000,
      amount: 1_001,
      currentReservedAmount: 500,
    });

    expect(result.status).toBe("error");
    expect(result.reservedAmount).toBe(500);
    expect(result.availableAmount).toBe(500);
    expect(result.message).toMatch(/exceeds the available treasury balance/i);
    expect(result.message).toMatch(/reduce the amount or add funds/i);
    expect(result.message).not.toMatch(/employee|salary/i);
  });

  it("rejects non-positive and non-finite amounts", () => {
    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = updateTreasuryReservation({ balance: BALANCE, amount });

      expect(result.status).toBe("error");
      expect(result.reservedAmount).toBe(0);
      expect(result.message).toMatch(/valid amount greater than zero/i);
      expect(result.message).not.toMatch(/employee|salary/i);
    }
  });

  it("allows reserving the full balance as a boundary case", () => {
    const result = updateTreasuryReservation({
      balance: BALANCE,
      amount: BALANCE,
    });

    expect(result.status).toBe("active");
    expect(result.reservedAmount).toBe(BALANCE);
    expect(result.availableAmount).toBe(0);
  });

  it("releases a reservation without exposing the previous amount", () => {
    const result = releaseTreasuryReservation(BALANCE);

    expect(result).toEqual(createIdleReservation(BALANCE));
    expect(result.reservedAmount).toBe(0);
    expect(result.availableAmount).toBe(BALANCE);
    expect(result.message).not.toMatch(/employee|salary/i);
  });

  it("formats aggregate amounts consistently", () => {
    expect(formatReservationAmount(PROJECTED_PAYROLL)).toBe("$19,500");
  });
});

describe("<TreasuryReservation />", () => {
  it("starts idle with a disabled release action and a privacy notice", () => {
    render(
      <TreasuryReservation balance={BALANCE} projectedPayroll={PROJECTED_PAYROLL} />,
    );

    expect(
      screen.getByRole("heading", { name: /payroll reservation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No funds are reserved/i)).toBeInTheDocument();
    expect(screen.getByTestId("reserved-amount")).toHaveTextContent("$0");
    expect(screen.getByTestId("available-after-reservation")).toHaveTextContent(
      "$45,000",
    );
    expect(screen.getByRole("button", { name: /release reservation/i })).toBeDisabled();
    expect(
      screen.getByText(/individual employee or salary data is not displayed/i),
    ).toBeInTheDocument();
  });

  it("reserves funds successfully using the aggregate default", () => {
    render(
      <TreasuryReservation balance={BALANCE} projectedPayroll={PROJECTED_PAYROLL} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /reserve funds/i }));

    expect(screen.getByTestId("reservation-status")).toHaveTextContent(
      /funds are reserved for the next payroll run/i,
    );
    expect(screen.getByTestId("reserved-amount")).toHaveTextContent("$19,500");
    expect(screen.getByTestId("available-after-reservation")).toHaveTextContent(
      "$25,500",
    );
    expect(
      screen.getByRole("button", { name: /release reservation/i }),
    ).toBeEnabled();
  });

  it("shows an actionable error and keeps the prior state when funds are insufficient", () => {
    render(
      <TreasuryReservation balance={1_000} projectedPayroll={500} />,
    );

    fireEvent.change(screen.getByLabelText("Amount to reserve"), {
      target: { value: "1001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reserve funds/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /amount exceeds the available treasury balance/i,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /reduce the amount or add funds/i,
    );
    expect(screen.getByTestId("reserved-amount")).toHaveTextContent("$0");
  });

  it("updates an existing reservation with another aggregate amount", () => {
    render(
      <TreasuryReservation balance={BALANCE} projectedPayroll={PROJECTED_PAYROLL} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /reserve funds/i }));
    fireEvent.change(screen.getByLabelText("Amount to reserve"), {
      target: { value: "10000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update reservation/i }));

    expect(screen.getByTestId("reserved-amount")).toHaveTextContent("$10,000");
    expect(screen.getByTestId("available-after-reservation")).toHaveTextContent(
      "$35,000",
    );
  });

  it("releases an active reservation and restores the default amount", () => {
    render(
      <TreasuryReservation balance={BALANCE} projectedPayroll={PROJECTED_PAYROLL} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /reserve funds/i }));
    fireEvent.click(screen.getByRole("button", { name: /release reservation/i }));

    expect(screen.getByTestId("reservation-status")).toHaveTextContent(
      /no funds are reserved/i,
    );
    expect(screen.getByTestId("reserved-amount")).toHaveTextContent("$0");
    expect(screen.getByLabelText("Amount to reserve")).toHaveValue(
      PROJECTED_PAYROLL,
    );
    expect(screen.getByRole("button", { name: /release reservation/i })).toBeDisabled();
  });
});
