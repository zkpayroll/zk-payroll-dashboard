import DashboardLayout from "@/components/layout/DashboardLayout";
import AmendmentApproval from "@/src/components/amendments/AmendmentApproval";

interface AmendmentApprovalPageProps {
  params: { id: string };
}

export default function AmendmentApprovalPage({ params }: AmendmentApprovalPageProps) {
  return (
    <DashboardLayout>
      <AmendmentApproval amendmentId={params.id} />
    </DashboardLayout>
  );
}
