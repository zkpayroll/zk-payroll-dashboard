"use client";

import {
  FileEdit,
  Cpu,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  History,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApprovalHistory } from "@/stores/approvalHistory";
import type { ApprovalEvent, ApprovalEventType } from "@/types";

interface ApprovalHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EVENT_CONFIG: Record<
  ApprovalEventType,
  { icon: typeof FileEdit; label: string; color: string }
> = {
  draft_created: {
    icon: FileEdit,
    label: "Draft Created",
    color: "text-blue-600 bg-blue-50",
  },
  draft_edited: {
    icon: FileEdit,
    label: "Draft Edited",
    color: "text-blue-600 bg-blue-50",
  },
  proof_generation_started: {
    icon: Cpu,
    label: "Proof Generation Started",
    color: "text-indigo-600 bg-indigo-50",
  },
  proof_generation_completed: {
    icon: ShieldCheck,
    label: "Proof Generated",
    color: "text-green-600 bg-green-50",
  },
  proof_generation_failed: {
    icon: ShieldAlert,
    label: "Proof Generation Failed",
    color: "text-red-600 bg-red-50",
  },
  payroll_confirmed: {
    icon: CheckCircle,
    label: "Payroll Confirmed",
    color: "text-emerald-600 bg-emerald-50",
  },
  submission_started: {
    icon: Send,
    label: "Submission Started",
    color: "text-indigo-600 bg-indigo-50",
  },
  submission_completed: {
    icon: CheckCircle,
    label: "Submission Completed",
    color: "text-green-600 bg-green-50",
  },
  submission_failed: {
    icon: AlertTriangle,
    label: "Submission Failed",
    color: "text-red-600 bg-red-50",
  },
};

function ApprovalEventItem({ event }: { event: ApprovalEvent }) {
  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  const formattedDate = new Date(event.timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const formattedTime = new Date(event.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const actorDisplay =
    event.actor.length > 20
      ? `${event.actor.slice(0, 6)}...${event.actor.slice(-4)}`
      : event.actor;

  return (
    <div className="flex gap-3 p-3 border border-gray-200 rounded-lg">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.color}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900">
            {config.label}
          </span>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {formattedDate}
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-0.5">{event.details}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
            {actorDisplay}
          </span>
          <span className="text-[10px] text-gray-400">{formattedTime}</span>
        </div>
      </div>
    </div>
  );
}

function ApprovalHistoryDrawer({ open, onOpenChange }: ApprovalHistoryDrawerProps) {
  const events = useApprovalHistory((s) => s.events);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader className="space-y-3 pb-6 border-b">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <SheetTitle className="text-2xl flex items-center gap-2">
                <History className="w-5 h-5" />
                Approval History
              </SheetTitle>
              <SheetDescription>
                Chronological log of all approval-related events for this
                payroll draft
              </SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">
              {events.length} event{events.length !== 1 ? "s" : ""} recorded
            </span>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History className="w-12 h-12 text-gray-300 mb-3" />
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                No Events Yet
              </h4>
              <p className="text-xs text-gray-500 max-w-xs">
                Approval events will appear here as you progress through the
                payroll draft process.
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-6">
              {events.map((event) => (
                <ApprovalEventItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default ApprovalHistoryDrawer;