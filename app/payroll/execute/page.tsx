import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollWizard from "@/components/features/payroll/PayrollWizard";
import { logRetryPolicyDecision } from "@/lib/payroll/retryPolicyLogging";

function PayrollExecutePage() {
  return (
    <DashboardLayout>
      <PayrollWizard onRetryPolicyDecision={logRetryPolicyDecision} />
    </DashboardLayout>
  );
}

export default PayrollExecutePage;
