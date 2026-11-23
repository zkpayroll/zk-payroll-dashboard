import DashboardLayout from "@/components/layout/DashboardLayout";
import TransactionHistory from "@/components/features/transactions/TransactionHistory";
import { RefreshablePayrollActivityTimeline } from "@/components/features/payroll/PayrollActivityTimeline";
import { RejectedCorrectionHistory } from "@/components/features/payroll/RejectedCorrectionHistory";

function HistoryPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TransactionHistory />
        {/* #769 — cancellation events (and other payroll activity) across
            all runs, surfaced in the same chronological timeline used on an
            individual run's detail page. */}
        <RefreshablePayrollActivityTimeline />
        {/* #844 — runs rejected after being sent back for corrections, so
            operators can see why a corrected run was still refused. */}
        <RejectedCorrectionHistory />
      </div>
    </DashboardLayout>
  );
}

export default HistoryPage;
