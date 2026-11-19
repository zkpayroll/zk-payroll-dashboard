"use client";

import { ApprovalExpiryBadge } from "@/components/signing/ApprovalExpiryBadge";
import type { PayrollRun } from "@/types";

export interface PayrollAdjustmentApprovalExpiryPanelProps {
  runs: PayrollRun[];
  title?: string;
}

export function PayrollAdjustmentApprovalExpiryPanel({
  runs,
  title = "Payroll adjustment approval expiry",
}: PayrollAdjustmentApprovalExpiryPanelProps) {
  const approvalRuns = runs.filter((run) => Boolean(run.approvalStatus));

  return (
    <section
      data-testid="payroll-adjustment-approval-expiry-panel"
      aria-labelledby="payroll-adjustment-approval-expiry-heading"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <h2
        id="payroll-adjustment-approval-expiry-heading"
        className="text-sm font-semibold text-gray-900"
      >
        {title}
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Approval freshness for payroll adjustments. Private payroll values are
        not shown.
      </p>

      {approvalRuns.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          No payroll adjustments have an approval record yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {approvalRuns.map((run) => {
            const approvedEntry = [...(run.approvalHistory ?? [])]
              .reverse()
              .find((entry) => entry.action === "approved");
            const approvedAt =
              approvedEntry?.approvedAt ??
              (run.approvalStatus === "approved" ? run.timestamp : null);

            return (
              <li
                key={run.id}
                className="flex flex-col gap-2 rounded-md border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Run {run.id}
                  </p>
                  <p className="text-xs text-gray-500">
                    {run.employeeCount} recipient(s) · status {run.status}
                  </p>
                </div>
                <ApprovalExpiryBadge
                  approvedAt={approvedAt}
                  approvalStatus={run.approvalStatus ?? null}
                  hasApproval={run.approvalStatus !== "draft"}
                  renewalHref="/payroll/approvals"
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default PayrollAdjustmentApprovalExpiryPanel;
