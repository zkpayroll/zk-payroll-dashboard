"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  X,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  DollarSign,
  Wallet,
  ArrowLeft,
  Users,
  Loader2,
  Clock,
  Shield,
  FileText,
  Circle,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { useEmployeeStore } from "@/stores/employees";
import { MOCK_EMPLOYEES, MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { Employee } from "@/types";
import OnboardingBadge from "./OnboardingBadge";
import EmptyState from "@/components/ui/EmptyState";
import WalletChangeReviewCard from "@/components/review/WalletChangeReviewCard";

export interface EmployeeDetailDrawerProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EmployeeDetailDrawer({ employee, isOpen, onClose }: EmployeeDetailDrawerProps) {
  const retryOnboarding = useEmployeeStore((s) => s.retryOnboarding);

  if (!isOpen || !employee) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Slide-over */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-[70] overflow-y-auto transform transition-transform duration-300 ease-in-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-details-heading"
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
          <h2 id="employee-details-heading" className="text-xl font-bold text-gray-900">
            Employee Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close details"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-24 w-24 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-indigo-600">
                {employee.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{employee.name}</h3>
            <p className="text-gray-500">{employee.department || "General"}</p>
            
            <div className="mt-4">
               <OnboardingBadge status={employee.onboardingStatus} />
            </div>
            {employee.onboardingError && (
              <div className="mt-4 w-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
                <p className="text-sm font-medium text-amber-800">Onboarding retry available</p>
                <p className="mt-1 text-xs text-amber-700">{employee.onboardingError}</p>
                <button
                  type="button"
                  onClick={() => retryOnboarding(employee.id)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  Retry onboarding
                </button>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <WalletChangeReviewCard employeeId={employee.id} employeeName={employee.name} />
            {/* Professional Info */}
            <section>
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Professional Information</h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Briefcase className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Department</p>
                    <p className="text-sm font-medium text-gray-900">{employee.department || "Not Assigned"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Start Date</p>
                    <p className="text-sm font-medium text-gray-900">{new Date(employee.startDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Monthly Salary</p>
                    <p className="text-sm font-medium text-gray-900">${employee.salary.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Account Info */}
            <section>
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Account Information</h4>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail className="w-3.5 h-3.5" /> Email Address
                  </div>
                  <p className="text-sm font-medium text-gray-900">{employee.email || "No email provided"}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Wallet className="w-3.5 h-3.5" /> Stellar Address
                  </div>
                  <p className="text-xs font-mono break-all bg-gray-100 p-2 rounded text-gray-600">
                    {employee.address}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <CustomCheckCircleIcon className="w-3.5 h-3.5 text-indigo-500" /> Salary Commitment
                  </div>
                  <p className="text-xs font-mono break-all text-gray-500">
                    {employee.salaryCommitment}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 p-6">
          <button 
            className="w-full bg-white border border-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

function CustomCheckCircleIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

interface CommitmentEntry {
  id: string;
  commitment: string;
  date: string;
  type: "created" | "updated";
}

function deriveStatus(e: Employee): "active" | "inactive" | "pending" {
  if (e.status) return e.status;
  if (!e.isActive) return "inactive";
  if (!e.lastPayment) return "pending";
  return "active";
}



function buildCommitmentHistory(employee: Employee): CommitmentEntry[] {
  const entries: CommitmentEntry[] = [
    {
      id: `${employee.id}-commit-1`,
      commitment: employee.salaryCommitment,
      date: employee.startDate,
      type: "created",
    },
  ];
  if (employee.lastPayment) {
    entries.push({
      id: `${employee.id}-commit-2`,
      commitment: employee.salaryCommitment,
      date: employee.lastPayment,
      type: "updated",
    });
  }
  return entries;
}

export default function EmployeeDetail({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const { employees: storedEmployees, isLoading } = useEmployeeStore();
  const retryOnboarding = useEmployeeStore((s) => s.retryOnboarding);

  const employees =
    storedEmployees.length > 0 ? storedEmployees : MOCK_EMPLOYEES;

  const employee = useMemo(
    () => employees.find((e) => e.id === employeeId),
    [employees, employeeId],
  );

  const commitmentHistory = useMemo(
    () => (employee ? buildCommitmentHistory(employee) : []),
    [employee],
  );

  const payrollActivity = useMemo(
    () => MOCK_PAYROLL_RUNS.filter((run) => run.employeeIds.includes(employeeId)),
    [employeeId],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading employee details…</span>
      </div>
    );
  }

  if (!employee) {
    return (
      <section aria-labelledby="employee-not-found-heading">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <button
              type="button"
              onClick={() => router.push("/employees")}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to employees
            </button>
          </div>
          <EmptyState
            icon={Users}
            title="Employee not found"
            description="The employee you're looking for doesn't exist or has been removed."
            action={{
              label: "View all employees",
              onClick: () => router.push("/employees"),
            }}
          />
        </div>
      </section>
    );
  }

  const status = deriveStatus(employee);

  return (
    <section aria-labelledby="employee-detail-heading" className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/employees")}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to employees
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-lg font-semibold text-indigo-700">
                {employee.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </span>
            </div>
            <div>
              <h2
                id="employee-detail-heading"
                className="text-xl font-semibold text-gray-900"
              >
                {employee.name}
              </h2>
              {employee.email && (
                <p className="text-sm text-gray-500">{employee.email}</p>
              )}
            </div>
            <StatusBadge status={status} showIcon={false} className="ml-auto px-3 py-1" />
          </div>

          {employee.onboardingStatus !== "completed" && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                Onboarding retry available
              </p>
              <p className="mt-1 text-xs text-amber-700">
                {employee.onboardingError ??
                  "This employee can be re-queued after validation, wallet, or commitment issues."}
              </p>
              <button
                type="button"
                onClick={() => retryOnboarding(employee.id)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Retry onboarding
              </button>
            </div>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Department</dt>
              <dd className="font-medium text-gray-900">
                {employee.department ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Start Date</dt>
              <dd className="font-medium text-gray-900">
                {new Date(employee.startDate).toLocaleDateString()}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Stellar Address</dt>
              <dd className="font-mono text-xs text-gray-900 break-all">
                {employee.address}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-500" aria-hidden="true" />
          <h3 className="text-sm font-medium text-gray-900">
            Salary Commitment History
          </h3>
        </div>

        {commitmentHistory.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No commitment records available.
          </div>
        ) : (
          <table className="w-full text-left">
            <caption className="sr-only">Salary commitment history</caption>
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                >
                  Event
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                >
                  Commitment Hash
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commitmentHistory.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 capitalize">
                      <Circle
                        className={`w-3 h-3 ${
                          entry.type === "created"
                            ? "text-green-500"
                            : "text-blue-500"
                        }`}
                        aria-hidden="true"
                      />
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-600">
                    {entry.commitment}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" aria-hidden="true" />
          <h3 className="text-sm font-medium text-gray-900">
            Payroll Activity
          </h3>
        </div>

        {payrollActivity.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No payroll activity found for this employee.
          </div>
        ) : (
          <table className="w-full text-left">
            <caption className="sr-only">Payroll activity</caption>
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                >
                  Run ID
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                >
                  Total Amount
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payrollActivity.map((run) => (
                <tr key={run.id}>
                  <td className="px-6 py-3 font-mono text-xs text-gray-900">
                    {run.id}
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    ${run.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
