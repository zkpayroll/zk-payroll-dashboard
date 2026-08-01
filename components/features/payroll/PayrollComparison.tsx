"use client";

import { useState, useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import type { PayrollRun } from "@/types/models";

interface PayrollComparisonProps {
  runs: PayrollRun[];
  selectedRunIds?: string[];
  onSelectRuns?: (runIds: string[]) => void;
}

interface ComparisonMetric {
  label: string;
  currentValue: number | string;
  previousValue: number | string;
  change?: number;
  changeType?: "increase" | "decrease" | "neutral";
  format?: "currency" | "number" | "status";
}

export default function PayrollComparison({
  runs,
  selectedRunIds = [],
  onSelectRuns,
}: PayrollComparisonProps) {
  const [compareIds, setCompareIds] = useState<string[]>(
    selectedRunIds.slice(0, 2),
  );

  const selectedRuns = useMemo(() => {
    return compareIds
      .map((id) => runs.find((run) => run.id === id))
      .filter(Boolean) as PayrollRun[];
  }, [compareIds, runs]);

  const handleSelectRun = (index: number, runId: string) => {
    const newIds = [...compareIds];
    newIds[index] = runId;
    setCompareIds(newIds);
    onSelectRuns?.(newIds);
  };

  const calculateMetrics = (): ComparisonMetric[] => {
    if (selectedRuns.length < 2) return [];

    const [current, previous] = selectedRuns;

    const amountChange =
      ((current.totalAmount - previous.totalAmount) / previous.totalAmount) *
      100;
    const employeeChange = current.employeeCount - previous.employeeCount;

    return [
      {
        label: "Total Amount",
        currentValue: current.totalAmount,
        previousValue: previous.totalAmount,
        change: amountChange,
        changeType:
          amountChange > 0
            ? "increase"
            : amountChange < 0
              ? "decrease"
              : "neutral",
        format: "currency",
      },
      {
        label: "Employee Count",
        currentValue: current.employeeCount,
        previousValue: previous.employeeCount,
        change: Math.abs(employeeChange),
        changeType:
          employeeChange > 0
            ? "increase"
            : employeeChange < 0
              ? "decrease"
              : "neutral",
        format: "number",
      },
      {
        label: "Status",
        currentValue: current.status,
        previousValue: previous.status,
        format: "status",
      },
      {
        label: "Avg per Employee",
        currentValue: current.totalAmount / current.employeeCount,
        previousValue: previous.totalAmount / previous.employeeCount,
        change:
          ((current.totalAmount / current.employeeCount -
            previous.totalAmount / previous.employeeCount) /
            (previous.totalAmount / previous.employeeCount)) *
          100,
        changeType:
          current.totalAmount / current.employeeCount >
          previous.totalAmount / previous.employeeCount
            ? "increase"
            : current.totalAmount / current.employeeCount <
                previous.totalAmount / previous.employeeCount
              ? "decrease"
              : "neutral",
        format: "currency",
      },
    ];
  };

  const formatValue = (
    value: number | string,
    format?: "currency" | "number" | "status",
  ) => {
    if (format === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(value as number);
    }
    if (format === "number") {
      return value.toLocaleString();
    }
    if (format === "status") {
      return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    }
    return value;
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const getChangeIcon = (changeType?: string) => {
    switch (changeType) {
      case "increase":
        return (
          <TrendingUp className="w-4 h-4 text-green-600" aria-hidden="true" />
        );
      case "decrease":
        return (
          <TrendingDown className="w-4 h-4 text-red-600" aria-hidden="true" />
        );
      default:
        return <Minus className="w-4 h-4 text-gray-400" aria-hidden="true" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return (
          <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
        );
    }
  };

  const metrics = calculateMetrics();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Compare Payroll Runs
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Select two payroll runs to compare metrics and identify changes over
          time
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {[0, 1].map((index) => (
            <div key={index}>
              <label
                htmlFor={`run-select-${index}`}
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {index === 0 ? "Current Period" : "Compare To"}
              </label>
              <select
                id={`run-select-${index}`}
                value={compareIds[index] || ""}
                onChange={(e) => handleSelectRun(index, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a run...</option>
                {runs.map((run) => (
                  <option
                    key={run.id}
                    value={run.id}
                    disabled={
                      compareIds.includes(run.id) &&
                      compareIds[index] !== run.id
                    }
                  >
                    {formatDate(run.timestamp)} - {run.employeeCount} employees
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {selectedRuns.length === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedRuns.map((run, index) => (
                <div
                  key={run.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {index === 0 ? "Current" : "Previous"}
                    </span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(run.status)}
                      <span className="text-xs text-gray-600 capitalize">
                        {run.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {formatDate(run.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        {run.employeeCount} employees
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Comparison Metrics
              </h3>
              <div className="space-y-3">
                {metrics.map((metric, index) => (
                  <div
                    key={index}
                    className="bg-white border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {metric.label}
                      </span>
                      {metric.change !== undefined && (
                        <div className="flex items-center gap-2">
                          {getChangeIcon(metric.changeType)}
                          <span
                            className={`text-sm font-medium ${
                              metric.changeType === "increase"
                                ? "text-green-600"
                                : metric.changeType === "decrease"
                                  ? "text-red-600"
                                  : "text-gray-600"
                            }`}
                          >
                            {metric.change > 0 && "+"}
                            {metric.change.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-gray-500">Current</span>
                        <p className="text-base font-semibold text-gray-900 mt-1">
                          {formatValue(metric.currentValue, metric.format)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Previous</span>
                        <p className="text-base font-medium text-gray-600 mt-1">
                          {formatValue(metric.previousValue, metric.format)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Privacy Note:</strong> This comparison shows aggregated
                metrics only. Individual salary information is not exposed.
              </p>
            </div>
          </div>
        )}

        {selectedRuns.length < 2 && compareIds.length === 2 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">
              Select two payroll runs to view comparison
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
