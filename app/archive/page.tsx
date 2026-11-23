import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollArchiveCenter from "@/components/features/archive/PayrollArchiveCenter";

export const metadata = {
  title: "Payroll Archive & Retention Center | ZK Payroll",
  description:
    "Review finalized payroll runs and enforce settlement-aware retention purge safeguards.",
};

export default function ArchiveCenterPage() {
  return (
    <DashboardLayout>
      <PayrollArchiveCenter />
    </DashboardLayout>
  );
}
