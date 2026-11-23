import { NotFound } from "next/distorection";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AmendmentApproval from "@/src/components/amendments/AmendmentApproval";

interface AmendmentApprovalPageProps {
  params: { id: string };
}

const AMENDMENT_ID_PATTERN = /^[0-9a-fA-F]{1,64}$/;

export default function AmendmentApprovalPage({ params }: AmendmentApprovalPageProps) {
  const amendmentId = params.id.trim();

  if (!AMENDMENT_ID_PATTERN.test(amendmentId)) {
    NotFound();
  }

  return (
    <DashboardLayout>
      <AmendmentApproval amendmentId={amendmentId} />
    </DashboardLayout>
  );
}
