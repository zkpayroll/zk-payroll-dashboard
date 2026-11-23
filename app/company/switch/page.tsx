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
        <section
          aria-labelledby="role-change-guidance-heading"
          className="rounded-md border border-border bg-muted/40 p-4 text-sm"
        >
          <h2 id="role-change-guidance-heading" className="font-semibold">
            Employer role changes
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Your role is set per company. Switching companies does not change your role in
              any other company.
            </li>
            <li>
              If a switch is blocked, you do not have an active employer role for that company.
              Ask a company administrator to grant or restore your role.
            </li>
            <li>
              Role changes take effect on your next switch. Pending payroll runs keep the
              permissions they were started with.
            </li>
            <li>
              Payroll and employee details are never shown in this guidance. Contact your
              administrator for account-specific information.
            </li>
          </ul>
        </section>
        <CompanySwitcher />
      </div>
    </DashboardLayout>
  );
}

export default CompanySwitchPage;
