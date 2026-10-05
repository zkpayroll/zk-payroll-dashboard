import DashboardLayout from "@/components/layout/DashboardLayout";
import { ExecutiveApprovalQueue } from "@/components/features/payroll/ExecutiveApprovalQueue";
import PayrollReviewRiskScoring from "@/components/features/payroll/PayrollReviewRiskScoring";
import { MOCK_PAYROLL_RUNS, MOCK_EMPLOYEES } from "@/lib/api/mockData";

export default function PayrollApprovalsPage() {
  const pendingRun = MOCK_PAYROLL_RUNS.find((r) => r.status === "pending");

  return (
    <DashboardLayout>
      {pendingRun && (
        <PayrollReviewRiskScoring
          payrollRun={pendingRun}
          employees={MOCK_EMPLOYEES}
        />
      )}
      <ExecutiveApprovalQueue />
    </DashboardLayout>
  );
}
