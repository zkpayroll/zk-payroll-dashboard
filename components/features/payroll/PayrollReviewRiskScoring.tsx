"use client";

import { useMemo } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import type {
  Employee,
  PayrollRun,
  RiskFactor,
  PayrollRiskScore,
} from "@/types/models";

interface PayrollReviewRiskScoringProps {
  payrollRun: PayrollRun;
  employees: Employee[];
  treasuryBalance?: number;
  className?: string;
}

const RISK_WEIGHTS: Record<string, number> = {
  treasury_balance: 30,
  stale_wallet: 15,
  invalid_address: 25,
  inactive_employee: 20,
  missing_commitment: 25,
  high_variance: 10,
  new_employee: 10,
  large_amount: 15,
};

const SEVERITY_SCORES: Record<string, number> = {
  low: 5,
  medium: 15,
  high: 25,
  critical: 40,
};

function calculateRiskScore(
  payrollRun: PayrollRun,
  employees: Employee[],
  treasuryBalance: number,
): PayrollRiskScore {
  const factors: RiskFactor[] = [];
  const selectedEmployees = employees.filter((e) =>
    payrollRun.employeeIds.includes(e.id),
  );

  // Check treasury balance
  const remaining = treasuryBalance - payrollRun.totalAmount;
  if (remaining < 0) {
    factors.push({
      type: "treasury_balance",
      severity: "critical",
      title: "Insufficient Treasury",
      description: `Payroll exceeds treasury by $${Math.abs(remaining).toLocaleString()}`,
      weight: RISK_WEIGHTS.treasury_balance,
    });
  } else if (remaining < 5000) {
    factors.push({
      type: "treasury_balance",
      severity: "high",
      title: "Low Treasury After Payroll",
      description: `Only $${remaining.toLocaleString()} will remain after this run`,
      weight: RISK_WEIGHTS.treasury_balance,
    });
  } else if (remaining < 15000) {
    factors.push({
      type: "treasury_balance",
      severity: "medium",
      title: "Moderate Treasury Draw",
      description: `Treasury will drop to $${remaining.toLocaleString()}`,
      weight: RISK_WEIGHTS.treasury_balance,
    });
  }

  // Check for stale wallets
  const now = new Date();
  const staleThreshold = 30 * 24 * 60 * 60 * 1000;
  const staleEmployees = selectedEmployees.filter((emp) => {
    if (!emp.lastPayment) return true;
    return now.getTime() - new Date(emp.lastPayment).getTime() > staleThreshold;
  });
  if (staleEmployees.length > 0) {
    factors.push({
      type: "stale_wallet",
      severity: staleEmployees.length > 2 ? "high" : "medium",
      title: "Stale Wallet Activity",
      description: `${staleEmployees.length} employee(s) haven't been paid recently`,
      weight: RISK_WEIGHTS.stale_wallet,
    });
  }

  // Check for invalid addresses
  const invalidEmployees = selectedEmployees.filter(
    (emp) => !emp.address || !/^G[A-Z2-7]{54}$/.test(emp.address),
  );
  if (invalidEmployees.length > 0) {
    factors.push({
      type: "invalid_address",
      severity: "critical",
      title: "Invalid Wallet Addresses",
      description: `${invalidEmployees.length} employee(s) have invalid addresses`,
      weight: RISK_WEIGHTS.invalid_address,
    });
  }

  // Check for inactive employees
  const inactiveEmployees = selectedEmployees.filter(
    (emp) => emp.status === "inactive" || emp.isActive === false,
  );
  if (inactiveEmployees.length > 0) {
    factors.push({
      type: "inactive_employee",
      severity: "high",
      title: "Inactive Employees in Run",
      description: `${inactiveEmployees.length} inactive employee(s) included`,
      weight: RISK_WEIGHTS.inactive_employee,
    });
  }

  // Check for missing commitments
  const missingCommitmentEmployees = selectedEmployees.filter(
    (emp) => !emp.salaryCommitment || !emp.salaryCommitment.startsWith("0x"),
  );
  if (missingCommitmentEmployees.length > 0) {
    factors.push({
      type: "missing_commitment",
      severity: "high",
      title: "Missing ZK Commitments",
      description: `${missingCommitmentEmployees.length} employee(s) lack salary commitments`,
      weight: RISK_WEIGHTS.missing_commitment,
    });
  }

  // Check for large amount
  if (payrollRun.totalAmount > 25000) {
    factors.push({
      type: "large_amount",
      severity: "medium",
      title: "High-Value Payroll",
      description: `Total amount $${payrollRun.totalAmount.toLocaleString()} exceeds typical run`,
      weight: RISK_WEIGHTS.large_amount,
    });
  }

  // Check for new employees (started within 30 days)
  const newEmployees = selectedEmployees.filter((emp) => {
    const startDate = new Date(emp.startDate);
    return now.getTime() - startDate.getTime() < 30 * 24 * 60 * 60 * 1000;
  });
  if (newEmployees.length > 0) {
    factors.push({
      type: "new_employee",
      severity: "low",
      title: "New Employees Included",
      description: `${newEmployees.length} employee(s) recently joined`,
      weight: RISK_WEIGHTS.new_employee,
    });
  }

  // Calculate overall score (0-100, higher = riskier)
  const totalSeverityScore = factors.reduce(
    (sum, f) => sum + SEVERITY_SCORES[f.severity],
    0,
  );
  const overallScore = Math.min(100, totalSeverityScore);

  let riskLevel: PayrollRiskScore["riskLevel"] = "clear";
  if (overallScore >= 60) riskLevel = "block";
  else if (overallScore >= 40) riskLevel = "warning";
  else if (overallScore >= 20) riskLevel = "caution";

  return {
    payrollId: payrollRun.id,
    overallScore,
    riskLevel,
    factors,
    calculatedAt: new Date().toISOString(),
  };
}

export function PayrollReviewRiskScoring({
  payrollRun,
  employees,
  treasuryBalance = 45000,
  className = "",
}: PayrollReviewRiskScoringProps) {
  const riskScore = useMemo(
    () => calculateRiskScore(payrollRun, employees, treasuryBalance),
    [payrollRun, employees, treasuryBalance],
  );

  const getRiskLevelConfig = (level: PayrollRiskScore["riskLevel"]) => {
    switch (level) {
      case "clear":
        return {
          label: "Clear",
          color: "emerald",
          icon: CheckCircle,
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          text: "text-emerald-800",
          badge: "bg-emerald-100 text-emerald-700",
        };
      case "caution":
        return {
          label: "Caution",
          color: "amber",
          icon: AlertTriangle,
          bg: "bg-amber-50",
          border: "border-amber-200",
          text: "text-amber-800",
          badge: "bg-amber-100 text-amber-700",
        };
      case "warning":
        return {
          label: "Warning",
          color: "orange",
          icon: AlertTriangle,
          bg: "bg-orange-50",
          border: "border-orange-200",
          text: "text-orange-800",
          badge: "bg-orange-100 text-orange-700",
        };
      case "block":
        return {
          label: "Block",
          color: "red",
          icon: XCircle,
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-800",
          badge: "bg-red-100 text-red-700",
        };
    }
  };

  const config = getRiskLevelConfig(riskScore.riskLevel);
  const RiskIcon = config.icon;

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${config.badge} flex items-center justify-center`}
          >
            <ShieldCheck className={`w-5 h-5 ${config.text}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              Payroll Review Risk Score
            </h3>
            <p className="text-sm text-gray-600">
              Risk assessment for payroll run {payrollRun.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {riskScore.overallScore}
            </div>
            <div className="text-xs text-gray-500">/ 100</div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${config.badge}`}
          >
            <RiskIcon className="w-3.5 h-3.5" />
            {config.label}
          </span>
        </div>
      </div>

      {/* Risk Score Bar */}
      <div className="mb-4">
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              riskScore.riskLevel === "clear"
                ? "bg-emerald-500"
                : riskScore.riskLevel === "caution"
                  ? "bg-amber-500"
                  : riskScore.riskLevel === "warning"
                    ? "bg-orange-500"
                    : "bg-red-500"
            }`}
            style={{ width: `${riskScore.overallScore}%` }}
          />
        </div>
      </div>

      {/* Risk Factors */}
      {riskScore.factors.length === 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-100/50 text-emerald-700">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">
            No risk factors detected. This payroll run is ready for review.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Risk Factors ({riskScore.factors.length})
          </h4>
          {riskScore.factors.map((factor, idx) => (
            <div
              key={`${factor.type}-${idx}`}
              className="flex items-start gap-3 p-3 rounded-lg bg-white/60 border border-gray-100"
            >
              <div
                className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                  factor.severity === "critical"
                    ? "bg-red-100"
                    : factor.severity === "high"
                      ? "bg-orange-100"
                      : factor.severity === "medium"
                        ? "bg-amber-100"
                        : "bg-gray-100"
                }`}
              >
                <TrendingUp
                  className={`w-3.5 h-3.5 ${
                    factor.severity === "critical"
                      ? "text-red-600"
                      : factor.severity === "high"
                        ? "text-orange-600"
                        : factor.severity === "medium"
                          ? "text-amber-600"
                          : "text-gray-600"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {factor.title}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      factor.severity === "critical"
                        ? "bg-red-100 text-red-700"
                        : factor.severity === "high"
                          ? "bg-orange-100 text-orange-700"
                          : factor.severity === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {factor.severity}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{factor.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PayrollReviewRiskScoring;
