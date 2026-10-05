import DashboardLayout from "@/components/layout/DashboardLayout";
import ReconciliationDiscrepancyInspector from "@/components/features/payroll/ReconciliationDiscrepancyInspector";

function ReconciliationInspectorPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reconciliation Inspector</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inspect mismatches between expected payroll outcomes and recorded transaction results.
          </p>
        </div>
        <ReconciliationDiscrepancyInspector />
      </div>
    </DashboardLayout>
  );
}

export default ReconciliationInspectorPage;
