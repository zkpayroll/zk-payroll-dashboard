import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PayrollRunDetail, {
  findPayrollRun,
} from "@/components/features/payroll/PayrollRunDetail";
import { MOCK_PROOF_REFERENCES } from "@/lib/api/mockData";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import type { UserRole } from "@/types";

interface PayrollRunPageProps {
  params: { id: string };
}

/**
 * Resolve the signed-in role for role-gated affordances on the run screen.
 * Falls back to the read-mostly `operator` view when there is no valid
 * session, so an unauthenticated render can never unlock admin-only controls.
 */
async function resolveUserRole(): Promise<UserRole> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return "operator";

  const session = await verifySessionToken(token);
  return session?.role ?? "operator";
}

async function PayrollRunPage({ params }: PayrollRunPageProps) {
  const run = findPayrollRun(params.id);
  if (!run) notFound();

  const userRole = await resolveUserRole();

  const lastUpdated = run.updatedAt
    ? new Date(run.updatedAt).toLocaleString()
    : "Never";

  return (
    <DashboardLayout>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </p>
      </div>
      <PayrollRunDetail
        run={run}
        proofReference={MOCK_PROOF_REFERENCES[params.id] ?? null}
        userRole={userRole}
      />
    </DashboardLayout>
  );
}

export default PayrollRunPage;
