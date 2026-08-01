"use client";

import { useMemo } from "react";
import { Building2, Users, DollarSign, AlertTriangle, ArrowRight } from "lucide-react";
import { useCompanyStore } from "@/stores/company";
import { useEmployeeStore } from "@/stores/employees";
import {
  MOCK_COMPANIES,
  MOCK_EMPLOYEES,
  MOCK_TREASURY_BALANCE,
  MOCK_TRANSACTIONS,
} from "@/lib/api/mockData";
import { CompanyConfigHealthPanel } from "./CompanyConfigHealthPanel";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  accent?: "green" | "yellow" | "red";
}) {
  const accentClass =
    accent === "green"
      ? "text-green-600"
      : accent === "yellow"
        ? "text-yellow-600"
        : accent === "red"
          ? "text-red-600"
          : "text-indigo-600";

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <Icon className={`h-5 w-5 ${accentClass}`} aria-hidden />
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
      {href && (
        <a
          href={href}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
        >
          View details <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

export default function AdminOverview() {
  const { company: storedCompany } = useCompanyStore();
  const { employees: storedEmployees } = useEmployeeStore();

  const company = storedCompany ?? MOCK_COMPANIES[0];
  const employees = storedEmployees.length > 0 ? storedEmployees : MOCK_EMPLOYEES;
  const treasury = MOCK_TREASURY_BALANCE;

  const activeCount = useMemo(
    () => employees.filter((e) => e.isActive).length,
    [employees],
  );

  const pendingCount = useMemo(
    () =>
      MOCK_TRANSACTIONS.filter((tx) => tx.status === "pending").length,
    [],
  );

  const surplus = treasury.balance - treasury.projectedPayroll;
  const treasuryStatus: "green" | "yellow" | "red" =
    surplus >= 10_000 ? "green" : surplus >= 0 ? "yellow" : "red";

  return (
    <section aria-labelledby="admin-overview-heading" className="space-y-6">
      <h2 id="admin-overview-heading" className="text-xl font-semibold text-gray-900">
        Admin Overview
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Company status"
          value={company?.isActive ? "Active" : "Inactive"}
          sub={company?.name}
          accent={company?.isActive ? "green" : "red"}
          href="/compliance"
        />

        <StatCard
          icon={DollarSign}
          label="Treasury balance"
          value={`$${treasury.balance.toLocaleString()}`}
          sub={`Projected payroll $${treasury.projectedPayroll.toLocaleString()}`}
          accent={treasuryStatus}
          href="/history"
        />

        <StatCard
          icon={Users}
          label="Active employees"
          value={String(activeCount)}
          sub={`${employees.length} total`}
          accent="green"
          href="/employees"
        />

        <StatCard
          icon={AlertTriangle}
          label="Pending actions"
          value={String(pendingCount)}
          sub={pendingCount > 0 ? "Requires attention" : "All clear"}
          accent={pendingCount > 0 ? "yellow" : "green"}
          href="/payroll"
        />
      </div>

      <CompanyConfigHealthPanel />
    </section>
  );
}

