import DashboardLayout from "@/components/layout/DashboardLayout";
import TransactionHistory from "@/components/features/transactions/TransactionHistory";
import { RefreshablePayrollActivityTimeline } from "@/components/features/payroll/PayrollActivityTimeline";

function HistoryPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TransactionHistory />
        {/* #769 — cancellation events (and other payroll activity) across
            all runs, surfaced in the same chronological timeline used on an
            individual run's detail page. */}
        <RefreshablePayrollActivityTimeline />
      </div>
    </DashboardLayout>
  );
}

export default HistoryPage;
