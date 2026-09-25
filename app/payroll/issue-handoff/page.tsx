import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollIssueHandoffPanel from "@/components/handoff/PayrollIssueHandoffPanel";
import { SAMPLE_PAYROLL_ISSUE_HANDOFFS } from "@/src/issues";

export default function PayrollIssueHandoffPage() {
  return (
    <DashboardLayout>
      <PayrollIssueHandoffPanel issues={SAMPLE_PAYROLL_ISSUE_HANDOFFS} />
    </DashboardLayout>
  );
}