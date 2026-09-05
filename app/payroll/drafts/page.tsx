import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollDraftRecovery from "@/components/features/drafts/PayrollDraftRecovery";

function PayrollDraftsPage() {
  return (
    <DashboardLayout>
      <PayrollDraftRecovery />
    </DashboardLayout>
  );
}

export default PayrollDraftsPage;
