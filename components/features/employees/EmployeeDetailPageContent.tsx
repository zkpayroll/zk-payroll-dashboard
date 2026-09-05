import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Loader2,
  Clock,
  Shield,
  FileText,
  Circle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useEmployeeStore } from "@/stores/employees";
import { MOCK_EMPLOYEES, MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { Employee } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import EmployeeAuditSidebar from "./EmployeeAuditSidebar";

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

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-800",
};

const PAYROLL_STATUS_ICON: Record<string, typeof CheckCircle2> = {
  verified: CheckCircle2,
  pending: Clock,
  failed: XCircle,
};

const PAYROLL_STATUS_COLOR: Record<string, string> = {
  verified: "text-green-600",
  pending: "text-yellow-600",
  failed: "text-red-600",
};

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

function EmployeeDetailPageContent({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const { employees: storedEmployees, isLoading } = useEmployeeStore();

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
            <span
              className={`ml-auto px-3 py-1 text-xs font-medium rounded-full ${STATUS_BADGE[status]}`}
            >
              {status}
            </span>
          </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2 space-y-6">
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
              {payrollActivity.map((run) => {
                const StatusIcon = PAYROLL_STATUS_ICON[run.status] ?? Clock;
                const statusColor = PAYROLL_STATUS_COLOR[run.status] ?? "text-gray-600";
                return (
                  <tr key={run.id}>
                    <td className="px-6 py-3 font-mono text-xs text-gray-900">
                      {run.id}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm ${statusColor}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      ${run.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      </div>

      <EmployeeAuditSidebar employee={employee} />
      </div>
    </section>
  );
}

export default EmployeeDetailPageContent;
