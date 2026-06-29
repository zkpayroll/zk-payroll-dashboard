"use client";

import { type LucideIcon } from "lucide-react";
import {
  Users,
  Receipt,
  Key,
  Building2,
  Search,
  Landmark,
  History,
  UserPlus,
  Play,
  ClipboardCheck,
  Shield,
  Upload,
} from "lucide-react";

// ─── Screen-specific empty-state definitions ─────────────────────
// These templates centralize copy so every screen reuses the same
// patterns. Add new entries when a new feature screen is created.

export type EmptyStateScreen =
  | "employees"
  | "employees-filtered"
  | "payroll"
  | "history"
  | "history-filtered"
  | "audit"
  | "audit-filtered"
  | "treasury"
  | "company"
  | "generic"
  | "search"
  | "first-employee"
  | "first-payroll"
  | "onboarding-incomplete"
  | "first-audit"
  | "import-review-empty";

export interface EmptyStateDefinition {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
}

/**
 * Central catalog of empty-state copy.
 * Every screen maps to a definition to keep messaging consistent.
 */
export const EMPTY_STATE_COPY: Record<EmptyStateScreen, EmptyStateDefinition> =
  {
    employees: {
      icon: Users,
      title: "No employees yet",
      description: "Add employees to get started with payroll.",
      actionLabel: "Add employee",
    },
    "employees-filtered": {
      icon: Users,
      title: "No employees match this filter",
      description: "Try adjusting the status filter to see more results.",
      actionLabel: "View all employees",
    },
    payroll: {
      icon: Receipt,
      title: "No payroll runs yet",
      description: "Process your first payroll to see it here.",
      actionLabel: "Start payroll",
    },
    history: {
      icon: History,
      title: "No transactions yet",
      description: "Process a payroll run to populate the transaction history.",
      actionLabel: "Process payroll",
    },
    "history-filtered": {
      icon: Search,
      title: "No transactions match the current filters",
      description: "Try broadening your filter criteria to see more results.",
      actionLabel: "Clear filters",
    },
    audit: {
      icon: Key,
      title: "No view keys generated",
      description:
        "Generate a view key to grant auditor access to payroll records.",
      actionLabel: "Generate view key",
    },
    "audit-filtered": {
      icon: Key,
      title: "No inactive view keys",
      description: "All generated keys are currently active.",
    },
    treasury: {
      icon: Landmark,
      title: "No treasury activity",
      description: "Treasury transactions will appear once payroll runs start.",
    },
    company: {
      icon: Building2,
      title: "Company not set up",
      description:
        "Complete your company setup to start managing payroll on Stellar.",
      actionLabel: "Set up now",
    },
    generic: {
      icon: Search,
      title: "Nothing here yet",
      description: "Data will appear once you start using this feature.",
    },
    search: {
      icon: Search,
      title: "No results found",
      description: "Try a different search term or adjust your filters.",
    },
    "first-employee": {
      icon: UserPlus,
      title: "Welcome! Start by adding your first employee",
      description:
        "Your team directory is empty. Add an employee with their Stellar wallet address to begin setting up payroll. Salary data is secured with zero-knowledge proofs.",
      actionLabel: "Add your first employee",
    },
    "first-payroll": {
      icon: Play,
      title: "Your first payroll run is ready to configure",
      description:
        "You have employees in the directory but haven't run payroll yet. Review the team, generate a ZK proof, and submit your first batch payment on Stellar.",
      actionLabel: "Execute first payroll",
    },
    "onboarding-incomplete": {
      icon: ClipboardCheck,
      title: "Complete your team setup",
      description:
        "Finish adding employees, verify their wallet addresses, and configure department assignments before running payroll. Everything else depends on accurate employee records.",
      actionLabel: "Continue onboarding",
    },
    "first-audit": {
      icon: Shield,
      title: "No audit trail configured",
      description:
        "Generate a view key to give your auditor read-only or full-audit access to payroll records. View keys expire automatically based on the duration you set.",
      actionLabel: "Create view key",
    },
    "import-review-empty": {
      icon: Upload,
      title: "No imported records awaiting review",
      description:
        "When you import employee records in bulk, they will appear here for validation before being added to the directory. Use the bulk import flow to get started.",
    },
  };

interface EmptyStateProps {
  /** Use a screen key for pre-defined copy, or override individual fields. */
  screen?: EmptyStateScreen;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyState({
  screen,
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  // Resolve from screen preset when provided, then allow overrides
  const preset = screen ? EMPTY_STATE_COPY[screen] : null;

  const resolvedIcon = icon ?? preset?.icon ?? EMPTY_STATE_COPY.generic.icon;
  const resolvedTitle = title ?? preset?.title ?? EMPTY_STATE_COPY.generic.title;
  const resolvedDescription =
    description ?? preset?.description ?? EMPTY_STATE_COPY.generic.description;
  const resolvedAction = action ?? (preset?.actionLabel
    ? { label: preset.actionLabel, onClick: () => {} }
    : undefined);

  const IconComponent = resolvedIcon;

  return (
    <div className="text-center py-12">
      <IconComponent
        className="w-10 h-10 text-gray-400 mx-auto mb-3"
        aria-hidden="true"
      />
      <h3 className="text-sm font-semibold text-gray-900 mb-1">
        {resolvedTitle}
      </h3>
      <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
        {resolvedDescription}
      </p>
      {resolvedAction && resolvedAction.label && (
        <button
          type="button"
          onClick={resolvedAction.onClick}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {resolvedAction.label}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
