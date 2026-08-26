"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Settings2,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";
import { MOCK_TREASURY_BALANCE } from "@/lib/api/mockData";
import type { TreasuryDrainConfig, TreasuryDrainSimulation } from "@/types/models";

interface TreasuryDrainWarningProps {
  currentBalance?: number;
  projectedDrain?: number;
  className?: string;
}

const DEFAULT_CONFIG: TreasuryDrainConfig = {
  reserveThreshold: 10000,
  emergencyReserve: 5000,
  warningEnabled: true,
};

function simulateDrain(
  currentBalance: number,
  projectedDrain: number,
  config: TreasuryDrainConfig,
): TreasuryDrainSimulation {
  const remainingAfterDrain = currentBalance - projectedDrain;
  const wouldExceedReserve = remainingAfterDrain < config.reserveThreshold;
  const wouldExceedEmergency = remainingAfterDrain < config.emergencyReserve;

  let severity: TreasuryDrainSimulation["severity"] = "safe";
  let message = "Treasury will remain above reserve thresholds after this run.";

  if (wouldExceedEmergency) {
    severity = "critical";
    message = `Critical: This payroll run would drain treasury below the emergency reserve of $${config.emergencyReserve.toLocaleString()}. Payroll execution is not recommended.`;
  } else if (wouldExceedReserve) {
    severity = "warning";
    message = `Warning: This payroll run would leave only $${remainingAfterDrain.toLocaleString()} in treasury, below the reserve threshold of $${config.reserveThreshold.toLocaleString()}.`;
  }

  return {
    currentBalance,
    projectedDrain,
    remainingAfterDrain,
    reserveThreshold: config.reserveThreshold,
    emergencyReserve: config.emergencyReserve,
    wouldExceedReserve,
    wouldExceedEmergency,
    severity,
    message,
  };
}

export function TreasuryDrainWarning({
  currentBalance = MOCK_TREASURY_BALANCE.balance,
  projectedDrain = MOCK_TREASURY_BALANCE.projectedPayroll,
  className = "",
}: TreasuryDrainWarningProps) {
  const [config, setConfig] = useState<TreasuryDrainConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);

  const simulation = useMemo(
    () => simulateDrain(currentBalance, projectedDrain, config),
    [currentBalance, projectedDrain, config],
  );

  if (!config.warningEnabled) return null;

  const getSeverityConfig = (severity: TreasuryDrainSimulation["severity"]) => {
    switch (severity) {
      case "safe":
        return {
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
          textColor: "text-emerald-800",
          descColor: "text-emerald-700",
        };
      case "warning":
        return {
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: AlertTriangle,
          iconColor: "text-amber-600",
          textColor: "text-amber-800",
          descColor: "text-amber-700",
        };
      case "critical":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          icon: ShieldAlert,
          iconColor: "text-red-600",
          textColor: "text-red-800",
          descColor: "text-red-700",
        };
    }
  };

  const sevConfig = getSeverityConfig(simulation.severity);
  const SeverityIcon = sevConfig.icon;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Warning Banner */}
      <div
        role="alert"
        className={`rounded-lg border ${sevConfig.border} ${sevConfig.bg} p-4`}
      >
        <div className="flex items-start gap-3">
          <SeverityIcon
            className={`w-5 h-5 mt-0.5 shrink-0 ${sevConfig.iconColor}`}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <h3 className={`text-sm font-semibold ${sevConfig.textColor}`}>
                Treasury Drain Simulation
              </h3>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Settings
              </button>
            </div>
            <p className={`text-sm mt-1 ${sevConfig.descColor}`}>
              {simulation.message}
            </p>

            {/* Drain Visualization */}
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs">Current Balance</span>
                <p className="font-semibold text-gray-900">
                  ${simulation.currentBalance.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Projected Drain
                </span>
                <p className="font-semibold text-red-600">
                  -${simulation.projectedDrain.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">After Payroll</span>
                <p
                  className={`font-semibold ${
                    simulation.wouldExceedEmergency
                      ? "text-red-600"
                      : simulation.wouldExceedReserve
                        ? "text-amber-600"
                        : "text-emerald-600"
                  }`}
                >
                  ${simulation.remainingAfterDrain.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Threshold Bars */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Reserve Threshold</span>
                <span className="font-medium">
                  ${config.reserveThreshold.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div className="relative h-full">
                  <div
                    className="absolute h-full bg-gray-400 rounded-full"
                    style={{
                      width: `${Math.min(100, (config.reserveThreshold / simulation.currentBalance) * 100)}%`,
                    }}
                  />
                  <div
                    className={`absolute h-full rounded-full ${
                      simulation.wouldExceedReserve ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (simulation.remainingAfterDrain / simulation.currentBalance) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Emergency Reserve</span>
                <span className="font-medium">
                  ${config.emergencyReserve.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div className="relative h-full">
                  <div
                    className="absolute h-full bg-red-300 rounded-full"
                    style={{
                      width: `${Math.min(100, (config.emergencyReserve / simulation.currentBalance) * 100)}%`,
                    }}
                  />
                  <div
                    className={`absolute h-full rounded-full ${
                      simulation.wouldExceedEmergency ? "bg-red-500" : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (simulation.remainingAfterDrain / simulation.currentBalance) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Drain Simulation Settings
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="reserveThreshold" className="block text-xs font-medium text-gray-600 mb-1">
                Reserve Threshold ($)
              </label>
              <input
                id="reserveThreshold"
                type="number"
                value={config.reserveThreshold}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    reserveThreshold: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Warning shown when balance falls below this
              </p>
            </div>
            <div>
              <label htmlFor="emergencyReserve" className="block text-xs font-medium text-gray-600 mb-1">
                Emergency Reserve ($)
              </label>
              <input
                id="emergencyReserve"
                type="number"
                value={config.emergencyReserve}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    emergencyReserve: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Critical alert when balance falls below this
              </p>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.warningEnabled}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      warningEnabled: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Enable drain warnings</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TreasuryDrainWarning;
