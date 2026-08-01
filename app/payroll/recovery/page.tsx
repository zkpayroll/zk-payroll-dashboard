import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollFailureRecoveryCenter from "@/components/features/payroll/PayrollFailureRecoveryCenter";

function RecoveryPage() {
  return (
    <DashboardLayout>
      <PayrollFailureRecoveryCenter />
    </DashboardLayout>
  );
}

export default RecoveryPage;