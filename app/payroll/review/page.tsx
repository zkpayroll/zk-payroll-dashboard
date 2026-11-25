import DashboardLayout from "@/components/layout/DashboardLayout";
import { PayloadInspector } from "@/components/signing/PayloadInspector";
import { RemovedEmployeesReview } from "@/components/payroll/RemovedEmployeesReview";
import { InactiveEmployeeWarning } from "@/components/warnings/InactiveEmployeeWarning";
import { PayrollReviewFailureGuidance } from "@/components/payroll/PayrollReviewFailureGuidance";
import { MOCK_PAYROLL_RUNS, MOCK_EMPLOYEES } from "@/lib/api/mockData";
import { MOCK_DRAFT_REMOVED_EMPLOYEES } from "@/lib/payroll/removedEmployees";

export default function PayrollReviewPage() {
  const pendingRun = MOCK_PAYROLL_RUNS.find(
    (r) => r.approvalStatus === "pending_executive_approval",
  );

  const fallbackRun = MOCK_PAYROLL_RUNS[0];

  const reviewRun = pendingRun ?? fallbackRun;

  const payload = reviewRun as unknown as Record<string, unknown>;

  // #792 / #797 — When the backend attaches a failure code to a run, surface
  // the human-readable guidance here so the reviewer sees what to do instead
  // of a raw contract error. The payload itself never carries private inputs.
  const failureCode =
    typeof payload.failureCode === "string" ? payload.failureCode : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Payroll Payload Review
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Inspect the signing payload before authorizing. Private fields are
            redacted by default to protect employee data.
          </p>
        </div>

        {failureCode && <PayrollReviewFailureGuidance code={failureCode} />}

        <InactiveEmployeeWarning
          employees={MOCK_EMPLOYEES}
          employeeIds={reviewRun.employeeIds}
        />

        <PayloadInspector
          payload={payload}
          heading={`Review: ${String(payload.id ?? "Payroll Run")}`}
          allowReveal={false}
        />

        <RemovedEmployeesReview
          removedEmployees={MOCK_DRAFT_REMOVED_EMPLOYEES}
        />
      </div>
    </DashboardLayout>
  );
}
