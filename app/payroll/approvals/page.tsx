import DashboardLayout from "@/components/layout/DashboardLayout";
import { ExecutiveApprovalQueue } from "@/components/features/payroll/ExecutiveApprovalQueue";
import PayrollReviewRiskScoring from "@/components/features/payroll/PayrollReviewRiskScoring";
import { InactiveEmployeeWarning } from "@/components/warnings/InactiveEmployeeWarning";
import { MOCK_PAYROLL_RUNS, MOCK_EMPLOYEES } from "@/lib/api/mockData";

export default function PayrollApprovalsPage() {
  const pendingRun = MOCK_PAYROLL_RUNS.find((r) => r.status === "pending");

  return (
    <DashboardLayout>
      {pendingRun && (
        <>
          <InactiveEmployeeWarning
            employees={MOCK_EMPLOYEES}
            employeeIds={pendingRun.employeeIds}
          />
          <PayrollReviewRiskScoring
            payrollRun={pendingRun}
            employees={MOCK_EMPLOYEES}
          />
        </>
      )}
      <ExecutiveApprovalQueue />
    </DashboardLayout>
  );
}
