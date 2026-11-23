import DashboardLayout from "@/components/layout/DashboardLayout";
import BeneficiaryChangesView from "@/components/features/beneficiaries/BeneficiaryChangesView";

export const metadata = {
  title: "Beneficiary Management | ZK Payroll",
  description: "Focused administrative interface for reviewing, verifying, and recovering employee beneficiary destinations.",
};

export default function BeneficiariesPage() {
  return (
    <DashboardLayout>
      <BeneficiaryChangesView />
    </DashboardLayout>
  );
}
