/**
 * Types for Payroll Period Boundary Recovery Flow (#884).
 *
 * Defines domain types for evaluating, explaining, and recovering from
 * invalid, inverted, or conflicting payroll period boundaries (settlement windows).
 *
 * Privacy Invariants:
 * - Never contains employee identifiers, names, salaries, wallet addresses, or ZK proof data.
 * - All representations use ISO calendar dates (YYYY-MM-DD), template references, and duration days.
 */

export type PeriodBoundaryStatus =
  | "healthy"
  | "inverted"
  | "overlap"
  | "invalid_start"
  | "invalid_end"
  | "timezone_spillover";

export type PeriodBoundaryRecoveryAction =
  | "shift_next_available"
  | "swap_dates"
  | "align_to_preceding"
  | "expand_standard_window"
  | "align_timezone"
  | "clear_conflicts"
  | "none";

export interface PeriodBoundaryDateRange {
  start: string;
  end: string;
}

export interface ConflictingBoundaryWindow {
  id: string;
  templateId?: string;
  templateName?: string;
  start: string;
  end: string;
}

export interface PeriodBoundaryRecoveryActionOption {
  action: PeriodBoundaryRecoveryAction;
  label: string;
  description: string;
  suggestedWindow?: PeriodBoundaryDateRange;
  enabled: boolean;
  disabledReason?: string;
}

export interface PeriodBoundaryRecoveryEvaluationInput {
  start: string;
  end: string;
  templateId?: string;
  templateFrequency?: "weekly" | "biweekly" | "monthly" | "quarterly";
  existingWindows?: Array<{
    id: string;
    templateId?: string;
    templateName?: string;
    start?: string;
    end?: string;
    windowStart?: string;
    windowEnd?: string;
  }>;
  excludeId?: string;
  timeZone?: string;
}

export interface PeriodBoundaryRecoveryPlan {
  status: PeriodBoundaryStatus;
  valid: boolean;
  candidate: PeriodBoundaryDateRange;
  recommendedAction: PeriodBoundaryRecoveryAction;
  actionableMessage: string;
  suggestedWindow: PeriodBoundaryDateRange | null;
  conflictingWindows: ConflictingBoundaryWindow[];
  actions: PeriodBoundaryRecoveryActionOption[];
  crossTemplateConflict: boolean;
}

export interface PeriodBoundaryRecoveryResult {
  ok: boolean;
  action: PeriodBoundaryRecoveryAction;
  recoveredWindow?: PeriodBoundaryDateRange;
  error?: string;
}
