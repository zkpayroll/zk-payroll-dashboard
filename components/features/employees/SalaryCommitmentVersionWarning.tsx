import { AlertTriangle } from "lucide-react";
import {
  getSalaryCommitmentVersionGuidance,
  isSupportedSalaryCommitmentVersion,
} from "@/lib/employees/salaryCommitmentVersion";

interface SalaryCommitmentVersionWarningProps {
  version: number | undefined;
}

export function SalaryCommitmentVersionWarning({
  version,
}: SalaryCommitmentVersionWarningProps) {
  if (isSupportedSalaryCommitmentVersion(version)) return null;

  const guidance = getSalaryCommitmentVersionGuidance(version);

  return (
    <div
      role="alert"
      data-testid="salary-commitment-version-warning"
      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p className="text-sm">{guidance}</p>
    </div>
  );
}
