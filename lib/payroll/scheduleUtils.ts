import type { PayrollRun } from "@/types/models";

export type RunScheduleKind = "scheduled" | "pending_approval" | "completed" | "failed";

export function classifyRun(run: PayrollRun): RunScheduleKind {
  if (run.status === "failed") return "failed";
  if (run.status === "verified") return "completed";
  if (run.approvalStatus === "pending_executive_approval") return "pending_approval";
  return "scheduled";
}

/**
 * Heatmap intensity (0-4) for a day's cell, based on how much operational
 * work is scheduled on that date. Failures and pending approvals weigh more
 * heavily than routine scheduled/completed runs since they demand attention.
 */
export function getHeatmapIntensity(runs: PayrollRun[]): number {
  if (runs.length === 0) return 0;
  const weight = runs.reduce((total, run) => {
    const kind = classifyRun(run);
    if (kind === "failed") return total + 3;
    if (kind === "pending_approval") return total + 2;
    return total + 1;
  }, 0);
  return Math.min(4, weight);
}

/** Priority order used to pick which run kind drives a heatmap cell's color. */
const HEAT_PRIORITY: RunScheduleKind[] = ["failed", "pending_approval", "scheduled", "completed"];

export function getDominantRunKind(runs: PayrollRun[]): RunScheduleKind | null {
  if (runs.length === 0) return null;
  const kinds = new Set(runs.map(classifyRun));
  return HEAT_PRIORITY.find((kind) => kinds.has(kind)) ?? null;
}

export function getRunDate(run: PayrollRun): Date {
  return new Date(run.timestamp || run.createdAt);
}

export function formatPayrollDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatPayrollMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function getNextUpcoming(runs: PayrollRun[]): PayrollRun | null {
  const scheduled = runs.filter((r) => classifyRun(r) === "scheduled");
  if (scheduled.length === 0) return null;
  return [...scheduled].sort(
    (a, b) => getRunDate(a).getTime() - getRunDate(b).getTime(),
  )[0];
}

export function sortRunsForSchedule(runs: PayrollRun[]): PayrollRun[] {
  const scheduled = runs
    .filter((r) => classifyRun(r) === "scheduled")
    .sort((a, b) => getRunDate(a).getTime() - getRunDate(b).getTime());
  const past = runs
    .filter((r) => classifyRun(r) !== "scheduled")
    .sort((a, b) => getRunDate(b).getTime() - getRunDate(a).getTime());
  return [...scheduled, ...past];
}

export function groupRunsByDateKey(runs: PayrollRun[]): Map<string, PayrollRun[]> {
  const map = new Map<string, PayrollRun[]>();
  for (const run of runs) {
    const key = getRunDate(run).toISOString().slice(0, 10);
    const existing = map.get(key) ?? [];
    existing.push(run);
    map.set(key, existing);
  }
  return map;
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getCalendarMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const leadingEmpty = firstDay.getUTCDay();
  const days: (Date | null)[] = Array.from({ length: leadingEmpty }, () => null);

  for (let day = 1; day <= lastDay.getUTCDate(); day++) {
    days.push(new Date(Date.UTC(year, month, day)));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}


export const RUN_KIND_STYLES: Record<
  RunScheduleKind,
  { badge: string; dot: string; label: string; heatBg: string[] }
> = {
  scheduled: {
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "bg-yellow-500",
    label: "Scheduled",
    heatBg: ["bg-yellow-50", "bg-yellow-100", "bg-yellow-200", "bg-yellow-300"],
  },
  pending_approval: {
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    dot: "bg-purple-500",
    label: "Pending approval",
    heatBg: ["bg-purple-50", "bg-purple-100", "bg-purple-200", "bg-purple-300"],
  },
  completed: {
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    label: "Completed",
    heatBg: ["bg-green-50", "bg-green-100", "bg-green-200", "bg-green-300"],
  },
  failed: {
    badge: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    label: "Failed",
    heatBg: ["bg-red-50", "bg-red-100", "bg-red-200", "bg-red-300"],
  },
};
