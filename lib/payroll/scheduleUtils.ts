import type { PayrollRun } from "@/types/models";

export type RunScheduleKind = "scheduled" | "completed" | "failed";

export function classifyRun(run: PayrollRun): RunScheduleKind {
  if (run.status === "failed") return "failed";
  if (run.status === "verified") return "completed";
  return "scheduled";
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
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingEmpty = firstDay.getDay();
  const days: (Date | null)[] = Array.from({ length: leadingEmpty }, () => null);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export const RUN_KIND_STYLES: Record<
  RunScheduleKind,
  { badge: string; dot: string; label: string }
> = {
  scheduled: {
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "bg-yellow-500",
    label: "Scheduled",
  },
  completed: {
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    label: "Completed",
  },
  failed: {
    badge: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    label: "Failed",
  },
};
