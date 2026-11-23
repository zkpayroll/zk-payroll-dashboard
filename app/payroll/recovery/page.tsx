import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollFailureRecoveryCenter from "@/components/features/payroll/PayrollFailureRecoveryCenter";
import { logRetryPolicyDecision } from "@/lib/payroll/retryPolicyDecisionLog";

function RecoveryPage() {
  return (
    <DashboardLayout>
      <PayrollFailureRecoveryCenter onRetryPolicyDecision={logRetryPolicyDecision} />
    </DashboardLayout>
  );
}

export default RecoveryPage;