"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  X,
} from "lucide-react";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "pending" | "in-progress" | "resolved";

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
  link?: string;
  actionLabel?: string;
  /** ISO timestamp after which the alert should be hidden. */
  expiresAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in-progress" | "completed";
  dueDate?: string;
  link?: string;
  actionLabel?: string;
}

export interface PayoutSchedule {
  id: string;
  label: string;
  scheduledAt: string;
  amount?: string;
  asset?: string;
}

export interface PayoutScheduleCollision {
  id: string;
  first: PayoutSchedule;
  second: PayoutSchedule;
  severity: AlertSeverity;
  message: string;
}

interface PinnedAlertsPanelProps {
  alerts?: Alert[];
  tasks?: Task[];
  payoutSchedules?: PayoutSchedule[];
  onDismissAlert?: (alertId: string) => void;
  onDismissTask?: (taskId: string) => void;
}

export default function PinnedAlertsPanel({
  alerts = [],
  tasks = [],
  payoutSchedules = [],
  onDismissAlert,
  onDismissTask,
}: PinnedAlertsPanelProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set(),
  );
  const [dismissedTasks, setDismissedTasks] = useState<Set<string>>(new Set());
  const [dismissedCollisions, setDismissedCollisions] = useState<Set<string>>(
    new Set(),
  );
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const visibleAlerts = alerts.filter(
    (alert) =>
      !dismissedAlerts.has(alert.id) &&
      alert.status !== "resolved" &&
      !isAlertExpired(alert, now),
  );
  const visibleTasks = tasks.filter(
    (task) => !dismissedTasks.has(task.id) && task.status !== "completed",
  );

  const detectedCollisions = detectPayoutScheduleCollisions(payoutSchedules);
  const visibleCollisions = detectedCollisions.filter(
    (collision) => !dismissedCollisions.has(collision.id),
  );

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(alertId));
    onDismissAlert?.(alertId);
  };

  const handleDismissTask = (taskId: string) => {
    setDismissedTasks((prev) => new Set(prev).add(taskId));
    onDismissTask?.(taskId);
  };

  const handleDismissCollision = (collisionId: string) => {
    setDismissedCollisions((prev) => new Set(prev).add(collisionId));
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return (
          <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
        );
      case "warning":
        return (
          <AlertTriangle
            className="w-5 h-5 text-amber-600"
            aria-hidden="true"
          />
        );
      case "info":
        return (
          <CheckCircle className="w-5 h-5 text-blue-600" aria-hidden="true" />
        );
    }
  };

  const getSeverityBorder = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return "border-l-4 border-l-red-500";
      case "warning":
        return "border-l-4 border-l-amber-500";
      case "info":
        return "border-l-4 border-l-blue-500";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-amber-100 text-amber-800";
      case "low":
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTimeAgo = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  if (
    visibleAlerts.length === 0 &&
    visibleTasks.length === 0 &&
    visibleCollisions.length === 0
  ) {
    return null;
  }

  return (
    <section
      aria-labelledby="pinned-alerts-heading"
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <h2
          id="pinned-alerts-heading"
          className="text-base font-semibold text-gray-900"
        >
          Attention Required
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          High-priority alerts and pending admin tasks
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {visibleCollisions.length > 0 && (
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-700">
              Payout Schedule Collisions
            </h3>
            <div className="space-y-3">
              {visibleCollisions.map((collision) => (
                <div
                  key={collision.id}
                  className={`bg-gray-50 rounded-lg p-4 ${getSeverityBorder(collision.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getSeverityIcon(collision.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {collision.first.label} overlaps with{" "}
                          {collision.second.label}
                        </h4>
                        <button
                          onClick={() => handleDismissCollision(collision.id)}
                          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label="Dismiss payout schedule collision"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {collision.message}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(collision.first.scheduledAt)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(collision.second.scheduledAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleAlerts.length > 0 && (
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Active Alerts</h3>
            <div className="space-y-3">
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`bg-gray-50 rounded-lg p-4 ${getSeverityBorder(alert.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {alert.title}
                        </h4>
                        <button
                          onClick={() => handleDismissAlert(alert.id)}
                          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label="Dismiss alert"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(alert.createdAt)}
                        </span>
                        {alert.link && (
                          <a
                            href={alert.link}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            {alert.actionLabel || "View details"}
                            <ChevronRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleTasks.length > 0 && (
          <div className="p-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Pending Tasks</h3>
            <div className="space-y-3">
              {visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-gray-50 rounded-lg p-4 border-l-4 border-l-indigo-500"
                >
                  <div className="flex items-start gap-3">
                    <Clock
                      className="w-5 h-5 text-indigo-600 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-gray-900">
                              {task.title}
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(task.priority)}`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {task.description}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDismissTask(task.id)}
                          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label="Dismiss task"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 mt-3">
                        {task.dueDate && (
                          <span className="text-xs text-gray-500">
                            Due {formatTimeAgo(task.dueDate)}
                          </span>
                        )}
                        {task.link && (
                          <a
                            href={task.link}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            {task.actionLabel || "Take action"}
                            <ChevronRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function isAlertExpired(alert: Alert, nowMs: number = Date.now()): boolean {
  if (!alert.expiresAt) {
    return false;
  }
  const expiresAt = new Date(alert.expiresAt).getTime();
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  return expiresAt <= nowMs;
}

export function detectPayoutScheduleCollisions(
  schedules: PayoutSchedule[],
  windowMs = 60 * 60 * 1000,
): PayoutScheduleCollision[] {
  const collisions: PayoutScheduleCollision[] = [];
  const validSchedules = schedules
    .map((schedule) => ({
      schedule,
      time: new Date(schedule.scheduledAt).getTime(),
    }))
    .filter(({ time }) => Number.isFinite(time))
    .sort((a, b) => a.time - b.time);

  for (let i = 0; i < validSchedules.length; i += 1) {
    for (let j = i + 1; j < validSchedules.length; j += 1) {
      const first = validSchedules[i];
      const second = validSchedules[j];
      const delta = second.time - first.time;

      if (delta > windowMs) {
        break;
      }

      const severity: AlertSeverity = delta === 0 ? "critical" : "warning";
      const minutesApart = Math.round(delta / 60000);
      const message =
        delta === 0
          ? `Both payouts are scheduled for the same time (${first.schedule.scheduledAt}).`
          : `Payouts are scheduled ${minutesApart} minute${minutesApart === 1 ? "" : "s"} apart, which may exceed the treasury window.`;

      collisions.push({
        id: `${first.schedule.id}::${second.schedule.id}`,
        first: first.schedule,
        second: second.schedule,
        severity,
        message,
      });
    }
  }

  return collisions;
}
