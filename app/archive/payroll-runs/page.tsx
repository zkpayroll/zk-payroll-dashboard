import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollArchiveCenter from "@/components/features/archive/PayrollArchiveCenter";

export const metadata = {
  title: "Payroll Run Archive Center | ZK Payroll",
  description: "Search, filter, and review finalized payroll runs separated from operational dashboards.",
};

export default function PayrollRunArchivePage() {
  return (
    <DashboardLayout>
      <PayrollArchiveCenter />
    </DashboardLayout>
  );
}
