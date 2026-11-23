"use client";

import React, { useEffect, useState } from "react";
import {
  Lock,
  RefreshCw,
  Clock,
  XCircle,
  Unlock,
  CheckCircle2,
  Calendar,
  Filter,
  Shield,
  Layers,
} from "lucide-react";
import {
  FundingReservationEvent,
  ReservationStateType,
  getFundingReservationTimeline,
  onFundingReservationEvent,
} from "@/lib/events/reservationEvents";

export interface ReservationTimelineProps {
  reservationId?: string;
  className?: string;
  initialEvents?: FundingReservationEvent[];
  maxEvents?: number;
  showFilters?: boolean;
}

const STATE_CONFIG: Record<
  ReservationStateType,
  {
    label: string;
    badgeClass: string;
    icon: React.ElementType;
    iconColor: string;
  }
> = {
  created: {
    label: "Created",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Lock,
    iconColor: "text-blue-600 bg-blue-50",
  },
  updated: {
    label: "Updated",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: RefreshCw,
    iconColor: "text-indigo-600 bg-indigo-50",
  },
  expired: {
    label: "Expired",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    icon: Clock,
    iconColor: "text-amber-600 bg-amber-50",
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    icon: XCircle,
    iconColor: "text-red-600 bg-red-50",
  },
  released: {
    label: "Released",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle2,
    iconColor: "text-green-600 bg-green-50",
  },
};

export function ReservationTimeline({
  reservationId,
  className = "",
  initialEvents,
  maxEvents,
  showFilters = true,
}: ReservationTimelineProps) {
  const [events, setEvents] = useState<FundingReservationEvent[]>(() => {
    if (initialEvents) return initialEvents;
    return getFundingReservationTimeline(reservationId);
  });
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  useEffect(() => {
    if (!initialEvents) {
      setEvents(getFundingReservationTimeline(reservationId));
    }

    const unsubscribe = onFundingReservationEvent((newEvent) => {
      if (!reservationId || newEvent.reservationId === reservationId) {
        setEvents((prev) => {
          if (prev.some((e) => e.id === newEvent.id)) return prev;
          return [newEvent, ...prev];
        });
      }
    });

    return () => unsubscribe();
  }, [reservationId, initialEvents]);

  const filteredEvents = events.filter((evt) => {
    if (selectedFilter === "all") return true;
    return evt.state === selectedFilter;
  });

  const displayedEvents = maxEvents
    ? filteredEvents.slice(0, maxEvents)
    : filteredEvents;

  const formatEventDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      data-testid="reservation-timeline"
      className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Layers className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-medium text-gray-900">
              Funding Reservation Timeline
            </h3>
            <p className="text-xs text-gray-500">
              Audit log of treasury reservation states & lock transitions
            </p>
          </div>
        </div>

        {/* Filter Badges */}
        {showFilters && events.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {["all", "created", "updated", "released", "expired", "cancelled"].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                  selectedFilter === filter
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline List */}
      <div className="p-6">
        {displayedEvents.length === 0 ? (
          <div
            data-testid="timeline-empty-state"
            className="py-10 text-center space-y-2"
          >
            <Clock className="w-8 h-8 text-gray-300 mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-600">
              No reservation timeline events recorded.
            </p>
            <p className="text-xs text-gray-400">
              Funding reservations and state changes will appear here in chronological order.
            </p>
          </div>
        ) : (
          <ol className="relative border-l border-gray-200 ml-4 space-y-6">
            {displayedEvents.map((evt) => {
              const config = STATE_CONFIG[evt.state] || STATE_CONFIG.created;
              const Icon = config.icon;

              return (
                <li
                  key={evt.id}
                  data-testid={`timeline-event-${evt.id}`}
                  className="ml-6 relative group"
                >
                  {/* Timeline bullet icon */}
                  <span
                    className={`absolute -left-10 flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-100 ${config.iconColor}`}
                    aria-hidden="true"
                  >
                    <Icon className="w-4 h-4" />
                  </span>

                  <div className="bg-gray-50/70 hover:bg-gray-50 border border-gray-200/70 rounded-lg p-3.5 transition-colors space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.badgeClass}`}
                        >
                          {config.label}
                        </span>
                        <span className="font-mono text-xs font-semibold text-gray-700">
                          {evt.reservationId}
                        </span>
                      </div>
                      <time
                        dateTime={evt.createdAt}
                        className="text-xs text-gray-500 flex items-center gap-1"
                      >
                        <Calendar className="w-3 h-3 text-gray-400" aria-hidden="true" />
                        {formatEventDate(evt.createdAt)}
                      </time>
                    </div>

                    <p className="text-xs text-gray-800 leading-relaxed font-medium">
                      {evt.summary}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-200/50 text-[11px] text-gray-500">
                      <div className="flex items-center gap-3">
                        {evt.payrollRunId && (
                          <span>
                            Payroll:{" "}
                            <span className="font-mono font-medium text-gray-700">
                              {evt.payrollRunId}
                            </span>
                          </span>
                        )}
                        {evt.amount !== undefined && (
                          <span>
                            Reserved:{" "}
                            <span className="font-semibold text-gray-900">
                              ${evt.amount.toLocaleString()}
                            </span>
                          </span>
                        )}
                      </div>
                      {evt.actor && (
                        <span className="text-gray-400">
                          Actor: {evt.actor}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Privacy Notice Footer */}
      <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>Zero-Knowledge: Individual employee compensation details are excluded from reservation logs.</span>
        </span>
        <span className="font-medium text-gray-600">
          {displayedEvents.length} event{displayedEvents.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

export default ReservationTimeline;
