import DashboardLayout from "@/components/layout/DashboardLayout";
import SnapshotLockApproval from "@/src/components/snapshots/SnapshotLockApproval";

interface SnapshotApprovalPageProps {
  params: { id: string };
}

export default function SnapshotApprovalPage({ params }: SnapshotApprovalPageProps) {
  return (
    <DashboardLayout>
      <SnapshotLockApproval snapshotId={params.id} />
    </DashboardLayout>
  );
}
