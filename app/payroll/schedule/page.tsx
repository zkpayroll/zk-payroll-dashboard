import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollCalendar from "@/components/features/payroll/PayrollCalendar";
import TreasuryFundingStatus from "@/components/features/treasury/TreasuryFundingStatus";
import PayrollHistory from "@/components/features/payroll/PayrollHistory";

function PayrollSchedulePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TreasuryFundingStatus />
        <PayrollCalendar />
      </div>
      <PayrollHistory />
    </DashboardLayout>
  );
}

export default PayrollSchedulePage;