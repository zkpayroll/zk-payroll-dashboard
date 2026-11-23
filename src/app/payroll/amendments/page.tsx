import DashboardLayout from "@/components/layout/DashboardLayout";
import AmendmentList from "@/src/components/amendments/AmendmentList";

export default function AmendmentsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Salary commitment amendments
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Review encrypted salary commitment changes. Salary values stay
            encrypted — only commitment version, employee reference, period,
            asset, and approval status are shown.
          </p>
        </div>
        <AmendmentList />
      </div>
    </DashboardLayout>
  );
}
