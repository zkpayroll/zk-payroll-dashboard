import { notFound } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollRunDetail, {
  findPayrollRun,
} from "@/components/features/payroll/PayrollRunDetail";
import { MOCK_PROOF_REFERENCES } from "@/lib/api/mockData";

interface PayrollRunPageProps {
  params: { id: string };
}

function PayrollRunPage({ params }: PayrollRunPageProps) {
  const run = findPayrollRun(params.id);
  if (!run) notFound();

  const lastUpdated = run.updatedAt
    ? new Date(run.updatedAt).toLocaleString()
    : "Never";

  return ({
    <DashboardLayout>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </p>
      </div>
      <PayrollRunDetail run={run} proofReference={MOCK_PROOF_REFERENCES[params.id] ?? null} />
    </DashboardLayout>
  );
}

export default PayrollRunPage;
