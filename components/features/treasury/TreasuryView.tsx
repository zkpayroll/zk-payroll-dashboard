"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, ArrowDownLeft, Plus, Lock } from "lucide-react";
import { MOCK_TREASURY_BALANCE, MOCK_TRANSACTIONS, MOCK_COMPANIES } from "@/lib/api/mockData";
import FundingForecast from "./FundingForecast";
import ReservationTimeline from "./ReservationTimeline";
import StatusBadge from "@/components/ui/StatusBadge";
import TreasuryReadinessChecklist from "./TreasuryReadinessChecklist";
import TreasuryDrainWarning from "./TreasuryDrainWarning";
import FundingImbalanceDashboard from "./FundingImbalanceDashboard";
import ReservationToastListener from "./ReservationToastListener";
import { createFundingReservation } from "@/lib/events/reservationEvents";

function TreasuryView() {
  const [toastVisible, setToastVisible] = useState(false);

  const handleReserveFunds = () => {
    createFundingReservation();
  };

  const { balance, projectedPayroll, lastFunded } = MOCK_TREASURY_BALANCE;
  const company = MOCK_COMPANIES[0];
  const isLowBalance = projectedPayroll > balance;
  const remaining = balance - projectedPayroll;

  const fundingHistory = MOCK_TRANSACTIONS.filter((t) => t.status === "verified");

  const handleAddFunds = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  return (
    <section aria-labelledby="treasury-heading" className="space-y-6">
      <ReservationToastListener />
      <h2 id="treasury-heading" className="text-lg font-semibold text-gray-900">
        Treasury
      </h2>

      {isLowBalance && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-red-800">Insufficient funds</p>
            <p className="text-sm text-red-700 mt-0.5">
              Projected payroll (${projectedPayroll.toLocaleString()}) exceeds available
              balance (${balance.toLocaleString()}). Add funds before executing payroll.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <article className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Available Balance</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            ${balance.toLocaleString()}
          </p>
          <span className="text-xs text-gray-500">
            Last funded {new Date(lastFunded).toLocaleDateString()}
          </span>
        </article>

        <article className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">Projected Payroll</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            ${projectedPayroll.toLocaleString()}
          </p>
          <span className="text-xs text-gray-500">Next scheduled run</span>
        </article>

        <article className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600">After Payroll</h3>
          <p
            className={`text-3xl font-bold mt-2 ${
              isLowBalance ? "text-red-600" : "text-green-700"
            }`}
          >
            {isLowBalance ? "-" : ""}${Math.abs(remaining).toLocaleString()}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {isLowBalance ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5 text-green-500" aria-hidden="true" />
            )}
            <span className={`text-xs ${isLowBalance ? "text-red-600" : "text-green-600"}`}>
              {isLowBalance ? "Deficit after payroll" : "Surplus after payroll"}
            </span>
          </div>
        </article>
      </div>

      <TreasuryDrainWarning
        currentBalance={balance}
        projectedDrain={projectedPayroll}
      />

      <FundingImbalanceDashboard />

      <TreasuryReadinessChecklist />

      <FundingForecast />

      <ReservationTimeline />

      {company && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-1">Treasury address</h3>
          <p className="text-xs font-mono text-gray-500 break-all">{company.treasury}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-900">Funding history</h3>
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={handleReserveFunds}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Reserve Funds
            </button>
            <button
              type="button"
              onClick={handleAddFunds}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add Funds
            </button>
            {toastVisible && (
              <div
                role="status"
                aria-live="polite"
                className="absolute right-0 top-full mt-2 w-56 px-3 py-2 rounded-md bg-gray-800 text-white text-xs shadow-lg"
              >
                On-chain funding coming soon.
              </div>
            )}
          </div>
        </div>

        {fundingHistory.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No funding activity yet.
          </div>
        ) : (
          <table className="w-full text-left">
            <caption className="sr-only">Treasury funding history</caption>
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fundingHistory.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4 text-green-600" aria-hidden="true" />
                    <span className="text-sm text-gray-900">Payroll disbursement</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    ${tx.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default TreasuryView;
