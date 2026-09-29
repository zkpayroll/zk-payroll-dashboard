"use client";

import { useState } from "react";
import { Info, ChevronDown, ChevronUp, AlertCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionFeeEstimateProps {
  /** Total payroll amount in USDC */
  totalAmount: number;
  /** Number of employees in the payroll run */
  employeeCount: number;
  /** Current network (for display purposes) */
  network?: string;
  /** Whether the fee estimate is loading */
  isLoading?: boolean;
  /** Optional error message */
  error?: string | null;
}

export function TransactionFeeEstimate({
  totalAmount,
  employeeCount,
  network = "Stellar Testnet",
  isLoading = false,
  error = null,
}: TransactionFeeEstimateProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Fee calculation logic (Stellar network fees)
  // Base fee: 0.00001 XLM per operation
  // Payroll batch: 1 operation per employee + 1 for the batch itself
  const operations = employeeCount + 1;
  const baseFeePerOp = 0.00001; // XLM
  const estimatedNetworkFeeXLM = operations * baseFeePerOp;
  const estimatedNetworkFeeUSD = estimatedNetworkFeeXLM * 0.1; // Rough XLM to USD conversion (~$0.10 per XLM)
  
  // Protocol fee (if any) - 0.1% of total amount, capped at $10
  const protocolFeePercent = 0.001; // 0.1%
  const protocolFeeUSDC = Math.min(totalAmount * protocolFeePercent, 10);
  
  // Total estimated fee in USD equivalent
  const totalEstimatedFeeUSD = estimatedNetworkFeeUSD + protocolFeeUSDC;
  const totalEstimatedFeeUSDC = totalEstimatedFeeUSD; // 1:1 for USDC

  const formatXLM = (value: number) => value.toFixed(6).replace(/\.?0+$/, '');
  const formatUSD = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="flex justify-between">
          <span className="text-gray-500">Network Transaction Fee</span>
          <div className="h-4 bg-gray-200 rounded w-24" />
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Protocol Fee</span>
          <div className="h-4 bg-gray-200 rounded w-24" />
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="font-semibold text-gray-800">Total Estimated Fee</span>
          <div className="h-4 bg-gray-200 rounded w-24" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
        <AlertCircle className="w-4 h-4" aria-hidden="true" />
        <span>Unable to estimate fees: {error}</span>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Summary row - always visible */}
      <div className="p-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900">Transaction Fee Estimate</span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-controls="fee-breakdown"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{isExpanded ? "Hide details" : "Show details"}</span>
          </button>
        </div>
        <div className="mt-1 flex items-baseline gap-2 text-right">
          <span className="text-sm font-semibold text-gray-900">
            ~${formatUSD(totalEstimatedFeeUSDC)} USDC
          </span>
          <span className="text-xs text-gray-400">
            (${formatXLM(estimatedNetworkFeeXLM)} XLM network + ~${protocolFeeUSDC.toFixed(2)} USDC protocol)
          </span>
        </div>
      </div>

      {/* Detailed breakdown - collapsible */}
      <div
        id="fee-breakdown"
        className={cn("transition-all duration-200 overflow-hidden", isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0")}
        role="region"
        aria-label="Fee breakdown details"
      >
        <div className="p-4 space-y-4">
          {/* Network Fee Section */}
          <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
                Network Fee (Stellar)
              </h5>
              <Info className="w-4 h-4 text-blue-500" aria-hidden="true" />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-blue-700">
                <span>Base fee per operation</span>
                <span className="font-mono font-medium">{baseFeePerOp.toFixed(5)} XLM</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>Operations (employees + batch)</span>
                <span className="font-mono font-medium">{operations}</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-1 text-blue-900">
                <span className="font-medium">Estimated network fee</span>
                <span className="font-mono font-semibold">{formatXLM(estimatedNetworkFeeXLM)} XLM (~${formatUSD(estimatedNetworkFeeUSD)})</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-blue-600">
              Stellar network fees are paid in XLM and are typically very low (&lt; $0.01 for most payroll runs).
              The fee scales with the number of payment operations in the batch.
            </p>
          </div>

          {/* Protocol Fee Section */}
          <div className="rounded-lg bg-indigo-50 p-3 border border-indigo-100">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">
                Protocol Fee (zkPayroll)
              </h5>
              <Info className="w-4 h-4 text-indigo-500" aria-hidden="true" />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-indigo-700">
                <span>Fee percentage</span>
                <span className="font-mono font-medium">{(protocolFeePercent * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-indigo-700">
                <span>Payroll amount</span>
                <span className="font-mono font-medium">${totalAmount.toLocaleString()} USDC</span>
              </div>
              <div className="flex justify-between border-t border-indigo-200 pt-1 text-indigo-900">
                <span className="font-medium">Calculated fee</span>
                <span className="font-mono font-semibold">${protocolFeeUSDC.toFixed(2)} USDC</span>
              </div>
              {protocolFeeUSDC === 10 && (
                <p className="text-xs text-indigo-600 mt-1">
                  Fee capped at maximum of $10.00 per payroll run.
                </p>
              )}
            </div>
            <p className="mt-2 text-xs text-indigo-600">
              The zkPayroll protocol applies a small fee to cover zero-knowledge proof verification
              and contract execution costs. This fee is paid from the treasury in USDC.
            </p>
          </div>

          {/* Total Section */}
          <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-gray-900">Total Estimated Fee</span>
              <span className="text-lg font-bold text-indigo-700">
                ~${formatUSD(totalEstimatedFeeUSDC)} USDC
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>Network: {formatXLM(estimatedNetworkFeeXLM)} XLM</span>
              <span>Protocol: ${protocolFeeUSDC.toFixed(2)} USDC</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              This estimate is based on current network conditions. Actual fees may vary slightly
              at the time of submission. Fees are paid from the company treasury.
            </p>
          </div>

          {/* Network info */}
          <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
            <div className="flex items-center gap-2 text-xs text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                <strong>Important:</strong> Ensure your treasury has sufficient XLM balance to cover
                network fees in addition to the USDC payroll amount. The network fee is paid in XLM
                from the submitting account.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TransactionFeeEstimate;
