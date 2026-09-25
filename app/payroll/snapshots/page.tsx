import DashboardLayout from "@/components/layout/DashboardLayout";
import SnapshotList from "@/src/components/snapshots/SnapshotList";

export default function SnapshotsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Obligation snapshot review
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Review payroll obligation snapshots before execution lock. Salary values stay
            encrypted — only merkle roots, commitment hashes, and safe metadata are shown.
          </p>
        </div>
        <SnapshotList />
      </div>
    </DashboardLayout>
  );
}
