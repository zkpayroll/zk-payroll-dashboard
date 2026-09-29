import { MOCK_EMPLOYEES, MOCK_TREASURY_BALANCE } from "@/lib/api/mockData";
import type { PayrollRun } from "@/types/models";

/**
 * Typed simulation results shown to operators before payroll execution.
 *
 * Privacy rule: checks never carry raw salary values — only aggregate or
 * commitment-based signals — so the payload is safe to render as-is.
 */
export type SimulationSeverity = "ready" | "warning" | "blocked";

export interface SimulationCheck {
  id: string;
  severity: SimulationSeverity;
  title: string;
  /** Operator-facing explanation; must not include private payroll values. */
  description: string;
  remediation?: {
    label: string;
    href: string;
  };
}

export interface SimulationSummary {
  ready: number;
  warning: number;
  blocked: number;
  canExecute: boolean;
}

export interface PayrollSimulationResult {
  runId: string;
  generatedAt: string;
  checks: SimulationCheck[];
  summary: SimulationSummary;
}

/** Rollup of check severities; any blocked check prevents execution. */
export function summarizeSimulation(checks: SimulationCheck[]): SimulationSummary {
  const ready = checks.filter((c) => c.severity === "ready").length;
  const warning = checks.filter((c) => c.severity === "warning").length;
  const blocked = checks.filter((c) => c.severity === "blocked").length;
  return { ready, warning, blocked, canExecute: blocked === 0 };
}

function buildChecks(run: PayrollRun): SimulationCheck[] {
  const checks: SimulationCheck[] = [];

  // Proof readiness
  if (!run.proof) {
    checks.push({
      id: "proof",
      severity: "blocked",
      title: "ZK proof missing",
      description:
        "No zero-knowledge proof is attached to this run. The contract cannot verify payroll without it.",
      remediation: { label: "Generate proof", href: "/payroll/execute" },
    });
  } else if (run.status === "pending") {
    checks.push({
      id: "proof",
      severity: "warning",
      title: "ZK proof awaiting verification",
      description:
        "A proof is attached but has not been verified on-chain yet. Execution may fail if verification rejects it.",
      remediation: { label: "Review proof status", href: `/payroll/${run.id}` },
    });
  } else {
    checks.push({
      id: "proof",
      severity: "ready",
      title: "ZK proof attached",
      description: "A payroll proof is attached and ready for submission.",
    });
  }

  // Treasury funding
  const balance = MOCK_TREASURY_BALANCE.balance;
  if (run.totalAmount > balance) {
    checks.push({
      id: "funding",
      severity: "blocked",
      title: "Treasury funding insufficient",
      description:
        "The treasury balance does not cover this run in aggregate. Individual amounts stay hidden.",
      remediation: { label: "Fund treasury", href: "/treasury" },
    });
  } else if (balance - run.totalAmount < MOCK_TREASURY_BALANCE.projectedPayroll / 2) {
    checks.push({
      id: "funding",
      severity: "warning",
      title: "Treasury buffer low after execution",
      description:
        "Executing this run leaves the treasury with a thin safety buffer for the next cycle.",
      remediation: { label: "Top up treasury", href: "/treasury" },
    });
  } else {
    checks.push({
      id: "funding",
      severity: "ready",
      title: "Treasury funded",
      description: "The treasury covers this run with a safe buffer remaining.",
    });
  }

  // Employee commitments
  const employees = MOCK_EMPLOYEES.filter((e) => run.employeeIds.includes(e.id));
  const missingCommitments = employees.filter((e) => !e.salaryCommitment).length;
  if (employees.length === 0) {
    checks.push({
      id: "commitments",
      severity: "blocked",
      title: "No employee records resolved",
      description:
        "This run references employees that no longer exist in the directory. Rebuild the batch before executing.",
      remediation: { label: "Open employees", href: "/employees" },
    });
  } else if (missingCommitments > 0) {
    checks.push({
      id: "commitments",
      severity: "blocked",
      title: "Salary commitments missing",
      description: `${missingCommitments} employee record(s) are missing salary commitments. Commitments are required to build a valid proof.`,
      remediation: { label: "Fix employee records", href: "/employees" },
    });
  } else {
    checks.push({
      id: "commitments",
      severity: "ready",
      title: "Salary commitments verified",
      description: "Every participant has an on-file salary commitment.",
    });
  }

  // Approval state
  if (run.approvalStatus && run.approvalStatus !== "approved") {
    checks.push({
      id: "approval",
      severity: "warning",
      title: "Executive approval outstanding",
      description:
        "This run still requires executive sign-off before it should be executed.",
      remediation: { label: "Open approvals", href: "/payroll/approvals" },
    });
  } else if (run.approvalStatus === "approved") {
    checks.push({
      id: "approval",
      severity: "ready",
      title: "Approval recorded",
      description: "Executive approval is on file for this run.",
    });
  }

  return checks;
}

/**
 * Fetch typed simulation results for a payroll run. Returns `null` when the
 * run id cannot be simulated (unknown id). Backed by deterministic local
 * data until the SDK wires up the live simulator.
 */
export async function fetchPayrollSimulation(
  runId: string,
  runs: PayrollRun[] = [],
): Promise<PayrollSimulationResult | null> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const run =
    runs.find((r) => r.id === runId) ?? null;
  if (!run) return null;

  const checks = buildChecks(run);
  return {
    runId: run.id,
    generatedAt: new Date().toISOString(),
    checks,
    summary: summarizeSimulation(checks),
  };
}
