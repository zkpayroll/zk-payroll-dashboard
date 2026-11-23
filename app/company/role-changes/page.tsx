import DashboardLayout from "@/components/layout/DashboardLayout";
import EmployerRoleChangePreview from "@/components/features/company/EmployerRoleChangePreview";

export const metadata = {
  title: "Employer Role Changes | ZK Payroll",
  description:
    "How the dashboard behaves when an employer account's role is promoted, demoted, or moved.",
};

function EmployerRoleChangesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Employer Role Changes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            See what a teammate gains or loses when their role changes, and where they are sent
            if their current page is no longer available.
          </p>
        </div>
        <EmployerRoleChangePreview />
      </div>
    </DashboardLayout>
  );
}

export default EmployerRoleChangesPage;
