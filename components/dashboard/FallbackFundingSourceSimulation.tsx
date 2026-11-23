"tuse client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCc, ShieldAlert, Loader2 } from "lucide-react";
import {
  selectAndValidateFailoverSource,
  type FundingSource,
  type FailoverPolicy,
  type FailoverEvaluationContext,
  type FailoverSelectionResult,
} from "@/src/payroll/fundingSourceFailoverValidation";

/**
 * Default failover policy used by the dashboard simulation.
 * These values mirror the treasury defaults and are exposed so operators
 * can understand why a candidate was selected or rejected.
 */
export const DEFAULT_FAILOVER_POLICY: FailoverPolicy = {
  bufferPercentage: 0.1,
  maxAutomaticFailoverLimit: 10_000,
  cooldownPeriodSeconds: 3600,
  requireOperatorConfirmationAboveLimit: true,
};

/**
 * Default funding sources used by the simulation when no explicit
 * sources are provided. These represent a typical treasury setup.
 */
export const DEFAULT_FUNDING_SOURCES: FundingSource[] = [
  {
    id: "treasury-primary",
    label: "Treasury Primary",
    sourceType: "treasury",
    assetCode: "USDC",
    availableBalance: 2_000,
    status: "active",
    priorityTier: 0,
  },
  {
    id: "backup-safe",
    label: "Treasury Safe Backup",
    sourceType: "multisig_vault",
    assetCode: "USDC",
    availableBalance: 8_000,
    status: "active",
    priorityTier: 1,
  },
  {
    id: "hot-reserve",
    label: "Hot Wallet Reserve",
    sourceType: "hot_wallet",
    assetCode: "USDC",
    availableBalance: 20_000,
    status: "active",
    priorityTier: 2,
  },
];

export interface FallbackSimulationProps {
  /** Funding sources available to the simulation. */
  sources?: FundingSource[];
  /** Failover policy governing selection. */
  policy?: FailoverPolicy;
  /** Payroll run identifier for the evaluation context. */
  payrollRunId?: string;
  /** Initial required amount (optional). */
  initialRequiredAmount?: number;
  /** Initial asset code (optional). */
  initialAssetCode?: string;
  /** Initial primary source id (optional). */
  initialPrimarySourceId?: string;
}

/**
 * Result of a single simulation run, including the effective
 * context and the validation outcome.
 */
export interface FallbackSimulationResult {
  context: FailoverEvaluationContext;
  result: FailoverSelectionResult;
}

/**
 * Build a failover evaluation context from simulation inputs.
 * This is pure so it can be tested independently of React.
 */
export function buildSimulationContext(inputs: {
  payrollRunId: string;
  requiredAmount: number;
  requiredAssetCode: string;
  primarySourceId: string;
  operatorConfirmed?: boolean;
  now?: number;
}): FailoverEvaluationContext {
  return {
    payrollRunId: inputs.payrollRunId,
    requiredAmount: inputs.requiredAmount,
    requiredAssetCode: inputs.requiredAssetCode,
    primarySourceId: inputs.primarySourceId,
    operatorConfirmed: inputs.operatorConfirmed ?? false,
    now: inputs.now ?? Date.now(),
  };
}

/**
 * Validate simulation inputs before running the failover selection.
 * Returns an actionable message when inputs are invalid.
 */
export function validateSimulationInputs(inputs: {
  requiredAmount: number;
  requiredAssetCode: string;
  primarySourceId: string;
}): { valid: boolean; message: string } {
  if (!Number.isFinite(inputs.requiredAmount) || inputs.requiredAmount <= 0) {
    return {
      valid: false,
      message: "Required amount must be a positive number.",
    };
  }
  if (!inputs.requiredAssetCode || inputs.requiredAssetCode.trim().length === 0) {
    return {
      valid: false,
      message: "Required asset code is required.",
    };
  }
  if (!inputs.primarySourceId || inputs.primarySourceId.trim().length === 0) {
    return {
      valid: false,
      message: "Primary funding source id required.",
    };
  }
  return { valid: true, message: "Inputs are valid." };
}

/**
 * Run the fallback funding source simulation for the given inputs.
 * This is the pure core used by the React component and by tests.
 */
export function runFallbackSimulation(args: {
  sources: FundingSource[];
  policy: FailoverPolicy;
  context: FailoverEvaluationContext;
}): FallbackSimulationResult {
  const result = selectAndValidateFailoverSource(args.sources, args.context, args.policy);
  return { context: args.context, result };
}

function formatUsdc(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function FallbackFundingSourceSimulation({
  sources = DEFAULT_FUNDING_SOURCES,
  policy = DEFAULT_FAILOVER_POLICY,
  payrollRunId = "simulation-run",
  initialRequiredAmount = 5_000,
  initialAssetCode = "USDC",
  initialPrimarySourceId = "treasury-primary",
}: FallbackSimulationProps) {
  const [requiredAmountRaw, setRequiredAmountRaw] = useState<string>(String(initialRequiredAmount));
  const [assetCode, setAssetCode] = useState<string>(initialAssetCode);
  const [primarySourceId, setPrimarySourceId] = useState<string>(initialPrimarySourceId);
  const [operatorConfirmed, setOperatorConfirmed] = useState<boolean>(false);
  const [simulation, setSimulation] = useState<FallbackSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const parsedAmount = Number(requiredAmountRaw);

  const inputValidation = useMemo(
    () =>
      validateSimulationInputs({
        requiredAmount: parsedAmount,
        requiredAssetCode: assetCode,
        primarySourceId: primarySourceId,
      }),
    [parsedAmount, assetCode, primarySourceId],
  );

  const handleSimulate = () => {
    setError(null);
    if (!inputValidation.valid) {
      setError(inputValidation.message);
      setSimulation(null);
      return;
    }
    setIsRunning(true);
    try {
      const context = buildSimulationContext({
        payrollRunId,
        requiredAmount: parsedAmount,
        requiredAssetCode: assetCode.trim().toUpperCase(),
        primarySourceId: primarySourceId.trim(),
        operatorConfirmed,
      });
      const run = runFallbackSimulation({ sources, policy, context });
      setSimulation(run);
    } catch (e) {
      setError(
        e instanceof Error
          ? `Fallback simulation failed: ${e.message}`
          : "Fallback simulation failed with an unknown error.",
      );
      setSimulation(null);
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setRequiredAmountRaw(String(initialRequiredAmount));
    setAssetCode(initialAssetCode);
    setPrimarySourceId(initialPrimarySourceId);
    setOperatorConfirmed(false);
    setSimulation(null);
    setError(null);
  };

  const result = simulation?.result;
  const isValid = result?.isValid ?? true;

  return (
    <div className="space-6" data-testid="fallback-funding-simulation">
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Fallback Funding Source Simulation</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Preview which funding source the failover policy would select for a payroll run. No funds are moved.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Required amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={requiredAmountRaw}
              onChange={(e) => setRequiredAmountRaw(e.target.value)}
              data-testid="simulation-amount-input"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Asset code</span>
            <input
              type="text"
              value={assetCode}
              onChange={(e) => setAssetCode(e.target.value)}
              data-testid="simulation-asset-input"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Primary source id</span>
            <select
              value={primarySourceId}
              onChange={(e) => setPrimarySourceId(e.target.value)}
              data-testid="simulation-primary-source-select"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label} ({source.sourceType})
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={operatorConfirmed}
            onChange={(e) => setOperatorConfirmed(e.target.checked)}
            data-testid="simulation-operator-confirm"
            className="rounded border-gray-300"
          />
          Operator confirmation for failovers above the automatic limit
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSimulate}
            disabled={isRunning}
            data-testid="simulation-run-button"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCc className="w-4 h-4" />}
            Run simulation
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isRunning}
            data-testid="simulation-reset-button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          data-testid="simulation-error"
        >
          <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {simulation && (
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            {isValid ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
            <h3 className="text-base font-semibold text-gray-900">
              {isValid ? "Failover source qualified" : "Failover source rejected"}
            </h3>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Selected source</dt>
              <dd className="font-medium text-gray-900" data-testid="simulation-selected-source">
                {result?.selectedSource?.label ?? "None"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Required total (incl. buffer)</dt>
              <dd className="font-medium text-gray-900" data-testid="simulation-required-total">
                {formatUsdc(typeof result?.requiredTotal === "number" ? result.requiredTotal : simulation.context.requiredAmount)}
              </dd>
            </div>
          </dl>

          {result?.reasons && result.reasons.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-gray-600" data-testid="simulation-reasons">
              {result.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
