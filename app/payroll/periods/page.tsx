import DashboardLayout from "@/components/layout/DashboardLayout";
import { PeriodStatusFilter } from "@/components/payroll/PeriodStatusFilter";

export const metadata = {
  title: "Payroll Periods | ZK Payroll",
  description:
    "Narrow the payroll period list by draft, active, finalized, and archived status.",
};

function PayrollPeriodsPage() {
  return (
    <DashboardLayout>
      <PeriodStatusFilter />
    </DashboardLayout>
  );
}

export default PayrollPeriodsPage;
