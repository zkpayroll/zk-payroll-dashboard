"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Wallet, Clock } from "lucide-react";

interface RiskWarning {
  id: string;
  type: "low_balance" | "stale_wallet" | "unsupported_asset";
  severity: "warning" | "critical";
  title: string;
  description: string;
  details?: string[];
}

interface PayrollRiskWarningsProps {
  treasuryBalance: number;
  totalAmount: number;
  selectedEmployees: { id: string; name: string; salary: number }[];
  allEmployees: any[];
}

const STALE_WALLET_THRESHOLD_DAYS = 30;
const LOW_BALANCE_THRESHOLD = 25000;

export function PayrollRiskWarnings({
  treasuryBalance,
  totalAmount,
  selectedEmployees,
  allEmployees,
}: PayrollRiskWarningsProps) {
  const risks = useMemo(() => {
    const riskList: RiskWarning[] = [];

    // 1. Low Balance Risk
    const remainingBalance = treasuryBalance - totalAmount;
    if (
      treasuryBalance >= totalAmount &&
      remainingBalance < LOW_BALANCE_THRESHOLD
    ) {
      riskList.push({
        id: "low_balance",
        type: "low_balance",
        severity: "warning",
        title: "Low Balance Warning",
        description: `Treasury buffer is below recommended threshold after this payroll run.`,
        details: [
          `Current balance: $${treasuryBalance.toLocaleString()} USDC`,
          `After payroll: $${remainingBalance.toLocaleString()} USDC`,
          `Recommended minimum: $${LOW_BALANCE_THRESHOLD.toLocaleString()} USDC`,
          "Consider adding funds to maintain operational safety margin.",
        ],
      });
    }

    // 2. Stale Wallet Risk - Check if any employee hasn't been paid recently
    const now = new Date();
    const staleCutoff = new Date(
      now.getTime() - STALE_WALLET_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
    );
    const staleEmployees = selectedEmployees
      .map((emp) => {
        const fullEmp = allEmployees.find((e) => e.id === emp.id);
        return fullEmp;
      })
      .filter((emp) => {
        if (!emp || !emp.lastPayment) return false;
        const lastPaymentDate = new Date(emp.lastPayment);
        return lastPaymentDate < staleCutoff;
      });

    if (staleEmployees.length > 0) {
      riskList.push({
        id: "stale_wallet",
        type: "stale_wallet",
        severity: "warning",
        title: "Stale Wallet Activity Detected",
        description: `${staleEmployees.length} employee wallet(s) haven't received payments in over ${STALE_WALLET_THRESHOLD_DAYS} days.`,
        details: [
          `Affected employees: ${staleEmployees.map((e) => e.name).join(", ")}`,
          "Verify wallet addresses are still active and properly configured.",
          "Long payment gaps may indicate address changes or inactive accounts.",
        ],
      });
    }

    // 3. Unsupported Asset State Risk - Check for employees with invalid addresses or unsupported configurations
    const invalidAddressEmployees = selectedEmployees
      .map((emp) => {
        const fullEmp = allEmployees.find((e) => e.id === emp.id);
        return fullEmp;
      })
      .filter(
        (emp) => !emp || !emp.address || !isValidStellarAddress(emp.address),
      );

    if (invalidAddressEmployees.length > 0) {
      riskList.push({
        id: "unsupported_asset",
        type: "unsupported_asset",
        severity: "critical",
        title: "Unsupported Asset Configuration",
        description: `${invalidAddressEmployees.length} employee(s) have invalid or missing Stellar wallet addresses.`,
        details: [
          `Affected: ${invalidAddressEmployees.map((e) => e?.name || "Unknown").join(", ")}`,
          "USDC transfers require valid Stellar Classic addresses.",
          "Please update employee wallet addresses before proceeding.",
        ],
      });
    }

    return riskList;
  }, [treasuryBalance, totalAmount, selectedEmployees, allEmployees]);

  if (risks.length === 0) {
    return null;
  }

  // Separate critical and warning risks
  const criticalRisks = risks.filter((r) => r.severity === "critical");
  const warningRisks = risks.filter((r) => r.severity === "warning");

  return (
    <div className="space-y-3">
      {/* Critical Risks - High visibility */}
      {criticalRisks.map((risk) => (
        <div
          key={risk.id}
          role="alert"
          className="border-l-4 border-red-500 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3"
        >
          <AlertTriangle
            className="w-5 h-5 text-red-600 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-red-800">{risk.title}</h4>
            <p className="text-sm text-red-700 mt-0.5">{risk.description}</p>
            {risk.details && risk.details.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-700">
                {risk.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}

      {/* Warning Risks - Medium visibility */}
      {warningRisks.map((risk) => (
        <div
          key={risk.id}
          role="alert"
          className="border-l-4 border-amber-500 bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3"
        >
          <RiskIcon riskType={risk.type} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-amber-800">
              {risk.title}
            </h4>
            <p className="text-sm text-amber-700 mt-0.5">{risk.description}</p>
            {risk.details && risk.details.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-amber-700">
                {risk.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskIcon({ riskType }: { riskType: RiskWarning["type"] }) {
  const iconClass = "w-5 h-5 text-amber-600 mt-0.5 shrink-0";

  switch (riskType) {
    case "low_balance":
      return <Wallet className={iconClass} aria-hidden="true" />;
    case "stale_wallet":
      return <Clock className={iconClass} aria-hidden="true" />;
    case "unsupported_asset":
      return <AlertTriangle className={iconClass} aria-hidden="true" />;
    default:
      return <AlertTriangle className={iconClass} aria-hidden="true" />;
  }
}

/**
 * Validates if a string is a valid Stellar Classic address (public key)
 * Stellar addresses start with 'G' and are 56 characters long (base32 encoded)
 */
function isValidStellarAddress(address: string): boolean {
  if (!address) return false;
  // Stellar public key format: starts with 'G', 56 characters total
  return /^G[A-Z2-7]{54}$/.test(address);
}
