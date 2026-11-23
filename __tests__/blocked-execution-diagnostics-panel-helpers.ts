import type { BlockedExecutionReport } from "@/lib/sdk/blockedExecutionDiagnostics";

export function validateReportInput(report: unknown): string | null {
  if (!report || typeof report !== "object") return "A diagnostics report is required.";
  const r = report as Partial<BlockedExecutionReport>;
  if (typeof r.canExecute !== "boolean" || typeof r.isBlocked !== "boolean")
    return "Report has invalid execution flags.";
  if (!Array.isArray(r.blockers) || !Array.isArray(r.warnings))
    return "Report blockers and warnings must be arrays.";
  return null;
}
