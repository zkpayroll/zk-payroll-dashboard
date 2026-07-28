import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollCalendar from "@/components/features/payroll/PayrollCalendar";
import TreasuryFundingStatus from "@/components/features/treasury/TreasuryFundingStatus";

function PayrollSchedulePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TreasuryFundingStatus />
        <PayrollCalendar />
      </div>
    </DashboardLayout>
  );
}

export default PayrollSchedulePage;