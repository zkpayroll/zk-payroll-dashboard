"use client";

import { usePayrollWizardStore } from "@/stores/payrollWizard";
import { useAuditRequestStore } from "@/stores/auditRequests";
import { useImportReviewStore } from "@/stores/importReview";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

export interface SidebarBadges {
  executePayroll: number;
  compliance: number;
  employees: number;
}

export function useSidebarBadges(): SidebarBadges {
  const hasDraft = usePayrollWizardStore((s) => s.hasDraft);
  const pendingRequests = useAuditRequestStore(
    (s) => s.requests.filter((r) => r.status === "pending").length,
  );
  const pendingImports = useImportReviewStore(
    (s) => s.records.filter((r) => r.status === "pending").length,
  );

  const pendingPayrollRuns = MOCK_PAYROLL_RUNS.filter(
    (run) => run.status === "pending",
  ).length;

  const draftCount = hasDraft() ? 1 : 0;

  return {
    executePayroll: draftCount + pendingPayrollRuns,
    compliance: pendingRequests,
    employees: pendingImports,
  };
}
