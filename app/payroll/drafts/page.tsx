import DashboardLayout from "/@components/layout/DashboardLayout";
import PayrollDraftRecovery from "/@components/features/drafts/PayrollDraftRecovery";

function PayrollDraftsPage() {
  return (
    <DashboardLayout>
      <PayrollDraftRecovery showLastUpdated />
    </DashboardLayout>
  );
}

export default PayrollDraftsPage;
