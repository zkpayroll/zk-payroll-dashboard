import { Clock, ShieldCheck, UserCheck, UserX, RotateCcw, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import OnboardingBadge from "./OnboardingBadge";
import type { Employee } from "@/types";

interface AuditEvent {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
  icon: LucideIcon;
  tone: "neutral" | "warning" | "success" | "danger";
}

const TONE_CLASSES: Record<AuditEvent["tone"], string> = {
  neutral: "text-gray-400",
  success: "text-green-500",
  warning: "text-amber-500",
  danger: "text-red-500",
};

function deriveEligibilityStatus(e: Employee): "active" | "inactive" | "pending" {
  if (e.status) return e.status;
  if (!e.isActive) return "inactive";
  if (!e.lastPayment) return "pending";
  return "active";
}

/**
 * Builds a safe, salary-free audit timeline from fields already present on
 * the employee record (onboarding + eligibility signals only).
 */
function buildAuditTimeline(employee: Employee): AuditEvent[] {
  const events: AuditEvent[] = [
    {
      id: `${employee.id}-onboarding-start`,
      label: "Onboarding initiated",
      detail: "Employee record created and onboarding queued.",
      timestamp: employee.startDate,
      icon: Circle,
      tone: "neutral",
    },
  ];

  if (employee.lastOnboardingAttemptAt) {
    const failed = Boolean(employee.onboardingError);
    events.push({
      id: `${employee.id}-onboarding-attempt`,
      label: failed ? "Onboarding retry attempted" : "Onboarding attempt recorded",
      detail: failed
        ? (employee.onboardingError as string)
        : `Retry count: ${employee.onboardingRetryCount ?? 0}`,
      timestamp: employee.lastOnboardingAttemptAt,
      icon: RotateCcw,
      tone: failed ? "danger" : "warning",
    });
  }

  if (employee.onboardingStatus === "completed") {
    events.push({
      id: `${employee.id}-onboarding-complete`,
      label: "Onboarding completed",
      detail: "Employee cleared onboarding and became payroll-eligible.",
      timestamp: employee.lastPayment ?? employee.lastOnboardingAttemptAt ?? employee.startDate,
      icon: ShieldCheck,
      tone: "success",
    });
  }

  const eligibility = deriveEligibilityStatus(employee);
  if (eligibility === "inactive") {
    events.push({
      id: `${employee.id}-eligibility-inactive`,
      label: "Payroll eligibility revoked",
      detail: "Employee marked inactive and excluded from active payroll runs.",
      timestamp: employee.lastPayment ?? employee.lastOnboardingAttemptAt ?? employee.startDate,
      icon: UserX,
      tone: "danger",
    });
  } else if (eligibility === "active") {
    events.push({
      id: `${employee.id}-eligibility-active`,
      label: "Payroll eligibility confirmed",
      detail: "Employee is active and eligible for scheduled payroll runs.",
      timestamp: employee.lastPayment ?? employee.startDate,
      icon: UserCheck,
      tone: "success",
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export interface EmployeeAuditSidebarProps {
  employee: Employee;
}

export default function EmployeeAuditSidebar({ employee }: EmployeeAuditSidebarProps) {
  const timeline = buildAuditTimeline(employee);
  const lastUpdated = timeline[0]?.timestamp ?? employee.startDate;
  const eligibility = deriveEligibilityStatus(employee);

  return (
    <aside
      aria-labelledby="employee-audit-sidebar-heading"
      className="bg-white rounded-lg shadow-sm overflow-hidden h-fit"
    >
      <div className="px-6 py-4 border-b flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-gray-500" aria-hidden="true" />
        <h3 id="employee-audit-sidebar-heading" className="text-sm font-medium text-gray-900">
          Audit Summary
        </h3>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Onboarding Status</p>
          <OnboardingBadge status={employee.onboardingStatus} />
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Payroll Eligibility</p>
          <p className="text-sm font-medium text-gray-900 capitalize">{eligibility}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Last Update
          </p>
          <p className="text-sm font-medium text-gray-900">
            {new Date(lastUpdated).toLocaleString()}
          </p>
        </div>

        <div className="pt-1 border-t">
          <p className="text-xs text-gray-500 mt-4 mb-3">Activity Timeline</p>
          <ul aria-label="Employee audit timeline" className="space-y-4">
            {timeline.map((event) => {
              const Icon = event.icon;
              return (
                <li key={event.id} className="flex items-start gap-2.5">
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${TONE_CLASSES[event.tone]}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900">{event.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{event.detail}</p>
                    <p className="text-xxs text-gray-400 mt-0.5">
                      {new Date(event.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-xxs text-gray-400 pt-2 border-t">
          Salary amounts and commitment values are never shown in this summary.
        </p>
      </div>
    </aside>
  );
}
