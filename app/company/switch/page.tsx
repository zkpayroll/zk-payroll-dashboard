"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanySwitcher from "@/components/features/company/CompanySwitcher";
import { MOCK_COMPANIES } from "@/lib/api/mockData";
import { useCompanyStore } from "@/stores/company";
import { useWalletStore } from "@/stores/walletStore";
import {
  maskStellarAddress,
  type EmployerRoleRefreshResult,
} from "@/lib/company/employerRoleRefresh";

function CompanySwitchPage() {
  const company = useCompanyStore((s) => s.company) ?? MOCK_COMPANIES[0] ?? null;
  const lastRoleSnapshot = useCompanyStore((s) => s.lastRoleSnapshot);
  const refreshRoleBeforeSubmission = useCompanyStore(
    (s) => s.refreshRoleBeforeSubmission,
  );
  const publicKey = useWalletStore((s) => s.publicKey);
  const [refreshResult, setRefreshResult] =
    useState<EmployerRoleRefreshResult | null>(null);

  async function handlePreSubmissionRoleRefresh() {
    const activeTarget = company ?? MOCK_COMPANIES[0] ?? null;
    const result = await refreshRoleBeforeSubmission({
      cachedRole: lastRoleSnapshot?.role ?? "admin",
      currentPublicKey: publicKey ?? activeTarget?.admin ?? null,
      fetchLatestState: async () => ({
        company: activeTarget,
        role: "admin",
        refreshedAt: new Date().toISOString(),
      }),
    });
    setRefreshResult(result);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Switch Company</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch the active payroll company context and refresh live employer
            role ownership before payroll submission.
          </p>
        </div>
        <CompanySwitcher />

        <section
          aria-labelledby="employer-role-refresh-heading"
          data-testid="employer-role-refresh-panel"
          className="rounded-lg border border-border bg-card p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="employer-role-refresh-heading"
                className="text-base font-semibold"
              >
                Pre-Submission Employer Role Check
              </h2>
              <p className="text-xs text-muted-foreground">
                Re-verifies active employer admin ownership so mid-session role
                transfers or revocations are caught before payroll execution.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePreSubmissionRoleRefresh}
              data-testid="refresh-employer-role-btn"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Refresh Employer Role
            </button>
          </div>

          {company && (
            <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
              <span>
                Active company: <strong className="text-foreground">{company.name}</strong>
              </span>
              <span>
                Configured admin:{" "}
                <code className="font-mono text-foreground">
                  {maskStellarAddress(company.admin)}
                </code>
              </span>
            </div>
          )}

          {refreshResult && (
            <div
              role="status"
              data-testid="employer-role-refresh-status"
              className={`rounded-md border px-3 py-2 text-xs ${
                refreshResult.allowed
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
              }`}
            >
              {refreshResult.allowed
                ? `Employer admin role verified for ${refreshResult.snapshot?.company.name}. Ready for payroll submission.`
                : refreshResult.message}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

export default CompanySwitchPage;
