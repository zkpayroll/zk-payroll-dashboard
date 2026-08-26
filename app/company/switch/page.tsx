import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanySwitcher from "@/components/features/company/CompanySwitcher";

function CompanySwitchPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Switch Company</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch the active payroll company context. Blocked switches show why the target
            company is unavailable.
          </p>
        </div>
        <CompanySwitcher />
      </div>
    </DashboardLayout>
  );
}

export default CompanySwitchPage;
