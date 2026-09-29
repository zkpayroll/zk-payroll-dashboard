"use client";

import { emitPayrollEvent } from "@/src/observability/emitter";
import type { PayrollEvent } from "@/src/observability/types";

/**
 * Employer onboarding event helpers.
 * Privacy-safe: only company identifiers and step labels are emitted.
 * Salary amounts, treasury balances, or private keys are never logged.
 */

export type EmployerOnboardingStep =
  | "company_created"
  | "treasury_configured"
  | "contracts_deployed"
  | "employees_imported"
  | "verification_completed";

export const ONBOARDING_STEP_LABELS: Record<EmployerOnboardingStep, string> = {
  company_created: "Company profile created",
  treasury_configured: "Treasury verified",
  contracts_deployed: "Contracts deployed",
  employees_imported: "Employees imported",
  verification_completed: "Verification completed",
};

export interface EmployerOnboardingEventInput {
  employerId: string;
  employerName: string;
  step: EmployerOnboardingStep;
  status: "started" | "succeeded" | "failed";
  correlationId?: string;
  errorCategory?: string;
  errorLabel?: string;
}

/**
 * Emit a redacted employer onboarding observability event.
 * Uses the central `emitPayrollEvent` choke point so payload is
 * automatically redacted and never contains private payroll values.
 */
export function emitEmployerOnboardingEvent(
  input: EmployerOnboardingEventInput
): PayrollEvent {
  const correlationId = input.correlationId ?? `employer_${input.employerId}`;
  return emitPayrollEvent({
    correlationId,
    stage: "employer_onboarding",
    status: input.status,
    payload: {
      employerId: input.employerId,
      employerName: input.employerName,
      step: input.step,
      stepLabel: ONBOARDING_STEP_LABELS[input.step] ?? input.step,
      errorCategory: input.errorCategory,
      errorLabel: input.errorLabel,
    },
  });
}

/**
 * Helper to determine if an event is an employer onboarding event.
 */
export function isEmployerOnboardingEvent(event: PayrollEvent): boolean {
  return event.stage === "employer_onboarding";
}
