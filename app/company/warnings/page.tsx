import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyStateWarnings from "@/components/features/company/CompanyStateWarnings";

function CompanyWarningsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Company Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor company state and resolve blocked actions
          </p>
        </div>
        <CompanyStateWarnings />
      </div>
    </DashboardLayout>
  );
}

export default CompanyWarningsPage;
