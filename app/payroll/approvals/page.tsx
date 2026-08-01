import DashboardLayout from "@/components/layout/DashboardLayout";
import { ExecutiveApprovalQueue } from "@/components/features/payroll/ExecutiveApprovalQueue";

export default function PayrollApprovalsPage() {
  return (
    <DashboardLayout>
      <ExecutiveApprovalQueue />
    </DashboardLayout>
  );
}
