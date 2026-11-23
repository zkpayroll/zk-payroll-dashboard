"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useDraftScheduleWindowStore } from "@/stores/draftScheduleWindows";
import { MOCK_PAYROLL_TEMPLATES } from "@/lib/api/mockData";
import {
  evaluatePeriodBoundaryRecovery,
  applyPeriodBoundaryRecoveryAction,
} from "@/lib/payroll/periodBoundaryRecovery";
import type { PeriodBoundaryRecoveryPlan } from "@/types/periodBoundary";
import type { PayrollTemplate } from "@/types/models";
import PayrollScheduleEditor from "@/components/features/schedule/PayrollScheduleEditor";

export interface PayrollScheduleCollisionDetectorProps {
  templates?: PayrollTemplate[];
  className?: string;
  showEditor?: boolean;
}

interface DetectedBoundaryCollision {
  id: string;
  windowId: string;
  templateId: string;
  templateName: string;
  windowStart: string;
  windowEnd: string;
  plan: PeriodBoundaryRecoveryPlan;
}

export default function PayrollScheduleCollisionDetector({
  templates = MOCK_PAYROLL_TEMPLATES,
  className = "",
  showEditor = true,
}: PayrollScheduleCollisionDetectorProps) {
  const drafts = useDraftScheduleWindowStore((s) => s.drafts);
  const removeDraft = useDraftScheduleWindowStore((s) => s.removeDraft);
  const upsertDraft = useDraftScheduleWindowStore((s) => s.upsertDraft);

  const [announcement, setAnnouncement] = useState<string | null>(null);

  const collisions = useMemo<DetectedBoundaryCollision[]>(() => {
    const detected: DetectedBoundaryCollision[] = [];

    for (const draft of drafts) {
      const template = templates.find((t) => t.id === draft.templateId);
      const otherDrafts = drafts.filter((d) => d.id !== draft.id);

      const plan = evaluatePeriodBoundaryRecovery({
        start: draft.windowStart,
        end: draft.windowEnd,
        templateId: draft.templateId,
        templateFrequency: template?.frequency,
        existingWindows: otherDrafts.map((d) => ({
          id: d.id,
          templateId: d.templateId,
          templateName: templates.find((t) => t.id === d.templateId)?.name,
          start: d.windowStart,
          end: d.windowEnd,
        })),
        excludeId: draft.id,
      });

      if (!plan.valid && plan.status === "overlap") {
        detected.push({
          id: `collision_${draft.id}`,
          windowId: draft.id,
          templateId: draft.templateId,
          templateName: template?.name ?? draft.templateId,
          windowStart: draft.windowStart,
          windowEnd: draft.windowEnd,
          plan,
        });
      }
    }

    return detected;
  }, [drafts, templates]);

  const handleResolveCollision = (collision: DetectedBoundaryCollision) => {
    const action = collision.plan.recommendedAction;
    const template = templates.find((t) => t.id === collision.templateId);

    const result = applyPeriodBoundaryRecoveryAction(action, {
      start: collision.windowStart,
      end: collision.windowEnd,
      templateId: collision.templateId,
      templateFrequency: template?.frequency,
      existingWindows: drafts
        .filter((d) => d.id !== collision.windowId)
        .map((d) => ({
          id: d.id,
          templateId: d.templateId,
          start: d.windowStart,
          end: d.windowEnd,
        })),
      excludeId: collision.windowId,
    });

    if (result.ok && result.recoveredWindow) {
      upsertDraft({
        id: collision.windowId,
        templateId: collision.templateId,
        windowStart: result.recoveredWindow.start,
        windowEnd: result.recoveredWindow.end,
      });

      const message = `Recovered period boundary for ${collision.templateName}: shifted to ${result.recoveredWindow.start} → ${result.recoveredWindow.end}.`;
      setAnnouncement(message);
      toast.success("Period boundary recovered", { description: message });
    } else {
      toast.error("Unable to automatically recover period boundary.");
    }
  };

  const handleRemoveDraft = (windowId: string, templateName: string) => {
    removeDraft(windowId);
    const message = `Removed draft settlement window for ${templateName}.`;
    setAnnouncement(message);
    toast.success("Draft removed", { description: message });
  };

  const handleAutoRecoverAll = () => {
    let resolvedCount = 0;
    for (const collision of collisions) {
      const template = templates.find((t) => t.id === collision.templateId);
      const otherDrafts = useDraftScheduleWindowStore
        .getState()
        .drafts.filter((d) => d.id !== collision.windowId);

      const result = applyPeriodBoundaryRecoveryAction(collision.plan.recommendedAction, {
        start: collision.windowStart,
        end: collision.windowEnd,
        templateId: collision.templateId,
        templateFrequency: template?.frequency,
        existingWindows: otherDrafts.map((d) => ({
          id: d.id,
          templateId: d.templateId,
          start: d.windowStart,
          end: d.windowEnd,
        })),
        excludeId: collision.windowId,
      });

      if (result.ok && result.recoveredWindow) {
        upsertDraft({
          id: collision.windowId,
          templateId: collision.templateId,
          windowStart: result.recoveredWindow.start,
          windowEnd: result.recoveredWindow.end,
        });
        resolvedCount += 1;
      }
    }

    const message = `Resolved ${resolvedCount} boundary collision${resolvedCount === 1 ? "" : "s"}.`;
    setAnnouncement(message);
    toast.success("All boundary collisions resolved", { description: message });
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="payroll-schedule-collision-detector">
      {/* Collision Alert Banner */}
      {collisions.length > 0 ? (
        <section
          role="alert"
          aria-labelledby="boundary-collision-heading"
          data-testid="boundary-collision-alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700 shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="boundary-collision-heading" className="text-sm font-semibold text-amber-900">
                  Payroll Period Boundary Collisions Detected ({collisions.length})
                </h3>
                <p className="mt-1 text-xs text-amber-800">
                  Conflicting settlement window boundaries have been detected. Recover boundaries
                  to ensure continuous, non-overlapping payroll periods without private data exposure.
                </p>
              </div>
            </div>

            <button
              type="button"
              data-testid="auto-recover-all-btn"
              onClick={handleAutoRecoverAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Auto-Recover All Boundaries
            </button>
          </div>

          <div className="divide-y divide-amber-200 border-t border-amber-200 pt-3 space-y-3">
            {collisions.map((collision) => (
              <div
                key={collision.id}
                data-testid={`boundary-collision-item-${collision.windowId}`}
                className="pt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-900">{collision.templateName}</span>
                    <span className="font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">
                      {collision.windowStart} → {collision.windowEnd}
                    </span>
                  </div>
                  <p className="text-amber-800">{collision.plan.actionableMessage}</p>
                  {collision.plan.suggestedWindow && (
                    <p className="text-amber-900 font-medium text-[11px]">
                      Suggested recovery: {collision.plan.suggestedWindow.start} →{" "}
                      {collision.plan.suggestedWindow.end}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid={`recover-btn-${collision.windowId}`}
                    onClick={() => handleResolveCollision(collision)}
                    className="inline-flex items-center gap-1 rounded-md bg-white border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Apply Recovery
                  </button>
                  <button
                    type="button"
                    data-testid={`remove-draft-btn-${collision.windowId}`}
                    onClick={() => handleRemoveDraft(collision.windowId, collision.templateName)}
                    className="inline-flex items-center gap-1 rounded-md bg-white border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    title="Remove this draft window"
                  >
                    <Trash2 className="h-3 w-3 text-gray-500" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section
          data-testid="boundary-healthy-banner"
          className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-950">
                Period Boundaries Aligned
              </h3>
              <p className="mt-0.5 text-xs text-emerald-800">
                All scheduled and draft payroll period boundaries are non-overlapping and
                chronologically sound.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Accessible live announcement region */}
      {announcement && (
        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>
      )}

      {/* Embedded PayrollScheduleEditor if requested */}
      {showEditor && (
        <div className="space-y-4">
          <PayrollScheduleEditor templates={templates} />
        </div>
      )}
    </div>
  );
}
