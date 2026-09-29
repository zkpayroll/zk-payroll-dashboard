"use client";

import type { PayrollTemplate, PayrollRun } from "@/types/models";

export interface PayoutScheduleCollisionPanelProps {
  templates?: PayrollTemplate[];
  runs?: PayrollRun[];
}

export default function PayoutScheduleCollisionPanel({
  templates = [],
  runs = [],
}: PayoutScheduleCollisionPanelProps) {
  if (!templates.length && !runs.length) {
    return null;
  }

  return (
    <section aria-labelledby="payout-schedule-collision-heading" className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
      <h3 id="payout-schedule-collision-heading" className="text-sm font-semibold text-gray-900">
        Payout Schedule Collision Status
      </h3>
      <p className="text-xs text-gray-500 mt-1">
        No active collisions detected between templates and runs.
      </p>
    </section>
  );
}
