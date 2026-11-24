"use client";

import { useState } from "react";
import { LockKeyhole, ShieldCheck, Unlock } from "lucide-react";
import { MOCK_TREASURY_BALANCE } from "@/lib/api/mockData";
import {
  createIdleReservation,
  formatReservationAmount,
  getUnreservedAmount,
  releaseTreasuryReservation,
  updateTreasuryReservation,
  type TreasuryReservationState,
  type TreasuryReservationStatus,
} from "@/lib/treasury/reservation";

const STATUS_LABEL: Record<TreasuryReservationStatus, string> = {
  idle: "No reservation",
  active: "Reserved",
  error: "Not updated",
};

export interface TreasuryReservationProps {
  balance?: number;
  projectedPayroll?: number;
  assetCode?: string;
  className?: string;
}

export function TreasuryReservation({
  balance = MOCK_TREASURY_BALANCE.balance,
  projectedPayroll = MOCK_TREASURY_BALANCE.projectedPayroll,
  assetCode = "USDC",
  className = "",
}: TreasuryReservationProps) {
  const [amount, setAmount] = useState(String(projectedPayroll));
  const [state, setState] = useState<TreasuryReservationState>(() =>
    createIdleReservation(balance),
  );

  const isIdle = state.status === "idle";

  const handleReserve = () => {
    setState(
      updateTreasuryReservation({
        balance,
        amount: Number(amount),
        currentReservedAmount: state.reservedAmount,
        assetCode,
      }),
    );
  };

  const handleRelease = () => {
    setAmount(String(projectedPayroll));
    setState(releaseTreasuryReservation(balance));
  };

  return (
    <section
      aria-labelledby="treasury-reservation-heading"
      data-testid="treasury-reservation"
      className={`bg-white rounded-lg shadow-sm p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            id="treasury-reservation-heading"
            className="text-base font-medium text-gray-900"
          >
            Payroll reservation
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Hold an aggregate amount for the next payroll run. This is a local UI
            reservation and does not move funds on-chain.
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
            state.status === "active"
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : state.status === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-gray-200 bg-gray-50 text-gray-600"
          }`}
        >
          {STATUS_LABEL[state.status]}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:max-w-xs">
          <label
            htmlFor="treasury-reservation-amount"
            className="block text-xs font-medium text-gray-700"
          >
            Amount to reserve
          </label>
          <input
            id="treasury-reservation-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReserve}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            {isIdle ? "Reserve funds" : "Update reservation"}
          </button>
          <button
            type="button"
            onClick={handleRelease}
            disabled={isIdle}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
            Release reservation
          </button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-gray-600">Reserved amount</dt>
          <dd data-testid="reserved-amount" className="mt-1 font-semibold text-gray-900">
            {formatReservationAmount(state.reservedAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-600">
            Available after reservation
          </dt>
          <dd
            data-testid="available-after-reservation"
            className="mt-1 font-semibold text-gray-900"
          >
            {formatReservationAmount(
              getUnreservedAmount(balance, state.reservedAmount),
            )}
          </dd>
        </div>
      </dl>

      <p
        role={state.status === "error" ? "alert" : "status"}
        aria-live="polite"
        data-testid="reservation-status"
        className={`mt-4 rounded-md border px-3 py-2 text-xs ${
          state.status === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : state.status === "active"
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-gray-50 text-gray-600"
        }`}
      >
        {state.message}
      </p>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Only aggregate amounts are shown. Individual employee or salary data is
        not displayed.
      </p>
    </section>
  );
}

export default TreasuryReservation;
