import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollWizard from "@/components/features/payroll/PayrollWizard";
import DraftRecoveryPanel from "@/components/features/payroll/DraftRecoveryPanel";

function PayrollExecutePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <DraftRecoveryPanel />
        <PayrollWizard />
      </div>
    </DashboardLayout>
  );
}

export default PayrollExecutePage;
