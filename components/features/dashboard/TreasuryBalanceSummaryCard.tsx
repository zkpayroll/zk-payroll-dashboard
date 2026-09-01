"use client";

import { AlertTriangle, CheckCircle, Wallet } from "lucide-react";
import Link from "next/link";
import { MOCK_TREASURY_BALANCE } from "@/lib/api/mockData";

/**
 * Compact treasury balance summary surfaced on the main dashboard (#397).
 * Links out to the full /treasury view for detail and funding actions.
 */
function TreasuryBalanceSummaryCard() {
  const { balance, projectedPayroll, lastFunded } = MOCK_TREASURY_BALANCE;
  const isLowBalance = projectedPayroll > balance;
  const remaining = balance - projectedPayroll;

  return (
    <section aria-labelledby="treasury-summary-heading" className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gray-500" aria-hidden="true" />
          <h3 id="treasury-summary-heading" className="text-sm font-medium text-gray-600">
            Treasury Balance
          </h3>
        </div>
        <Link
          href="/treasury"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          View treasury &rarr;
        </Link>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900">
            ${balance.toLocaleString()}
          </p>
          <span className="text-xs text-gray-500">
            Last funded {new Date(lastFunded).toLocaleDateString()}
          </span>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1">
            {isLowBalance ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5 text-green-500" aria-hidden="true" />
            )}
            <span
              className={`text-sm font-semibold ${
                isLowBalance ? "text-red-600" : "text-green-700"
              }`}
            >
              {isLowBalance ? "-" : ""}${Math.abs(remaining).toLocaleString()}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {isLowBalance ? "Deficit after payroll" : "Surplus after payroll"}
          </span>
        </div>
      </div>
    </section>
  );
}

export default TreasuryBalanceSummaryCard;
