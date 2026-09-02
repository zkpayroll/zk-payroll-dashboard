import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollWizard from "@/components/features/payroll/PayrollWizard";
import TreasuryFundingStatus from "@/components/features/treasury/TreasuryFundingStatus";

function PayrollExecutePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TreasuryFundingStatus showDetails />
        <PayrollWizard />
      </div>
    </DashboardLayout>
  );
}

export default PayrollExecutePage;