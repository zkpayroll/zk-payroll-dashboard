import type { PauseCategory } from "@/lib/sdk/pauseStatus";
import { fetchPauseStatus } from "@/lib/sdk/pauseStatus";

/**
 * Mutation actions governed by contract pause guards in the dashboard layer.
 */
export type MutationAction =
  | "execute_payroll"
  | "create_payroll_draft"
  | "approve_payroll"
  | "reject_payroll"
  | "request_correction"
  | "resubmit_payroll"
  | "retry_failed_run"
  | "cancel_payroll"
  | "period_close";

/**
 * Read-only actions that remain permitted even when contracts are paused.
 */
export type ReadOnlyAction =
  | "view_payroll"
  | "view_audit"
  | "view_treasury"
  | "inspect_payload"
  | "export_payroll_report";

export type DashboardPayrollAction = MutationAction | ReadOnlyAction;

export const MUTATION_ACTIONS: readonly MutationAction[] = [
  "execute_payroll",
  "create_payroll_draft",
  "approve_payroll",
  "reject_payroll",
  "request_correction",
  "resubmit_payroll",
  "retry_failed_run",
  "cancel_payroll",
  "period_close",
] as const;

export function isMutationAction(action: string): action is MutationAction {
  return MUTATION_ACTIONS.includes(action as MutationAction);
}

/** Error codes for contract pause rejections. */
export const CONTRACT_PAUSED_CODE = "CONTRACT_PAUSED" as const;
export const MUTATION_DISABLED_CODE = "MUTATION_DISABLED_CONTRACTS_PAUSED" as const;

export type ContractPauseErrorCode =
  | typeof CONTRACT_PAUSED_CODE
  | typeof MUTATION_DISABLED_CODE;

export interface ContractPauseStateInput {
  isPaused: boolean;
  pausedCategories?: PauseCategory[] | string[];
  reason?: string | null;
}

export interface MutationGuardRemediation {
  label: string;
  href: string;
  action: string;
  suggestedAction: string;
}

export interface MutationGuardResult {
  allowed: boolean;
  action: DashboardPayrollAction;
  isMutation: boolean;
  code: ContractPauseErrorCode | null;
  message: string | null;
  remediation?: MutationGuardRemediation;
  categories: PauseCategory[];
}

/**
 * Checks whether contract operations are currently paused for a given category.
 * If pausedCategories is empty or omitted, all categories are considered paused.
 */
export function isContractPausedForCategory(
  category: PauseCategory = "payroll",
  state?: Partial<ContractPauseStateInput>,
): boolean {
  const isPaused = state?.isPaused ?? false;
  if (!isPaused) return false;

  const cats = state?.pausedCategories;
  if (!cats || cats.length === 0) {
    return true; // Empty array means all categories are paused
  }

  return cats.includes(category);
}

/**
 * Evaluates whether a dashboard action (mutation or read-only) is permitted
 * under the current or provided contract pause state.
 *
 * PRIVACY GUARANTEE:
 * Does not inspect, accept, log, or return sensitive employee data, salary
 * amounts, bank details, or private keys. The evaluation operates strictly
 * on contract pause flags, categories, and action types.
 */
export function canPerformMutation(
  action: DashboardPayrollAction,
  input?: Partial<ContractPauseStateInput>,
): MutationGuardResult {
  const isMutation = isMutationAction(action);

  // Read-only actions are always permitted
  if (!isMutation) {
    return {
      allowed: true,
      action,
      isMutation: false,
      code: null,
      message: null,
      categories: ((input?.pausedCategories as PauseCategory[]) || []),
    };
  }

  // Determine contract pause state from input or fallback to SDK fetch
  let isPaused: boolean;
  let categories: PauseCategory[];
  let reason: string | undefined;

  if (input !== undefined && "isPaused" in input) {
    isPaused = Boolean(input.isPaused);
    categories = (input.pausedCategories as PauseCategory[]) || [];
    reason = input.reason ?? undefined;
  } else {
    try {
      const sdkStatus = fetchPauseStatus();
      isPaused = sdkStatus.paused;
      categories = sdkStatus.categories;
      reason = sdkStatus.reason;
    } catch {
      // In case store is unavailable, fail safe to allow
      isPaused = false;
      categories = [];
    }
  }

  // If contracts are not paused, mutation is allowed
  if (!isPaused) {
    return {
      allowed: true,
      action,
      isMutation: true,
      code: null,
      message: null,
      categories,
    };
  }

  // If paused, check if the pause category affects payroll/mutations
  // Empty categories list implies all operations are paused
  const affectsPayroll =
    categories.length === 0 ||
    categories.includes("payroll") ||
    (action === "approve_payroll" && categories.includes("admin")) ||
    (action === "period_close" && categories.includes("admin"));

  if (!affectsPayroll) {
    return {
      allowed: true,
      action,
      isMutation: true,
      code: null,
      message: null,
      categories,
    };
  }

  const baseMessage =
    "Payroll smart contract operations are currently paused by administrative action. Mutation actions are disabled until contracts are resumed.";
  const actionableMessage = reason ? `${baseMessage} Reason: ${reason}` : baseMessage;

  return {
    allowed: false,
    action,
    isMutation: true,
    code: CONTRACT_PAUSED_CODE,
    message: actionableMessage,
    remediation: {
      label: "Review Pause Status",
      href: "/admin",
      action: "resume_contract",
      suggestedAction: "Resume company payroll operations from admin settings.",
    },
    categories,
  };
}

export class ContractPausedError extends Error {
  readonly code: ContractPauseErrorCode;
  readonly action: DashboardPayrollAction;
  readonly remediation?: MutationGuardRemediation;

  constructor(result: MutationGuardResult) {
    super(result.message || "Contract operations are paused");
    this.name = "ContractPausedError";
    this.code = result.code || CONTRACT_PAUSED_CODE;
    this.action = result.action;
    this.remediation = result.remediation;
  }
}

/**
 * Asserts that a mutation action is permitted under contract pause rules.
 * Throws `ContractPausedError` if the action is blocked.
 */
export function assertMutationAllowed(
  action: DashboardPayrollAction,
  input?: Partial<ContractPauseStateInput>,
): void {
  const result = canPerformMutation(action, input);
  if (!result.allowed) {
    throw new ContractPausedError(result);
  }
}
