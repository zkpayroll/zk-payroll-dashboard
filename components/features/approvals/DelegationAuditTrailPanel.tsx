"use client";

import { useMemo, useState } from "react";
import { History, UserPlus, Timer, Ban, Hourglass } from "lucide-react";
import {
  useDelegatedApproversStore,
} from "@/stores/delegatedApprovers";
import {
  buildDelegationAuditTrail,
  delegationAuditEventLabel,
  filterDelegationAuditTrailByAddress,
  type DelegationAuditEvent,
  type DelegationAuditEventType,
} from "@/lib/payroll/delegationAudit";

const EVENT_ICONS: Record<DelegationAuditEventType, typeof UserPlus> = {
  approver_added: UserPlus,
  temporary_delegation_scheduled: Timer,
  temporary_delegation_revoked: Ban,
  temporary_delegation_expired: Hourglass,
};

const EVENT_BADGE_STYLES: Record<DelegationAuditEventType, string> = {
  approver_added: "bg-indigo-50 text-indigo-700 border-indigo-200",
  temporary_delegation_scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  temporary_delegation_revoked: "bg-red-50 text-red-700 border-red-200",
  temporary_delegation_expired: "bg-gray-100 text-gray-500 border-gray-200",
};

export interface DelegationAuditTrailPanelProps {
  /** Optional explicit event list; defaults to deriving from store state. */
  events?: DelegationAuditEvent[];
  /** Optional clock override, primarily for deterministic tests. */
  now?: number;
  title?: string;
  description?: string;
}

/**
 * Privacy-safe, read-only audit trail of payroll approval delegation
 * responsibility — who was granted or revoked approver authority, and when.
 * Derived entirely from `stores/delegatedApprovers.ts`, so there's nothing
 * here to persist or drift out of sync (#681).
 */
export default function DelegationAuditTrailPanel({
  events: propEvents,
  now,
  title = "Delegation Responsibility Audit",
  description = "Chronological record of who was granted or revoked payroll approval authority, and when.",
}: DelegationAuditTrailPanelProps) {
  const approvers = useDelegatedApproversStore((s) => s.approvers);
  const temporaryDelegations = useDelegatedApproversStore((s) => s.temporaryDelegations);
  const [addressFilter, setAddressFilter] = useState("");

  const events = useMemo(
    () => propEvents ?? buildDelegationAuditTrail(approvers, temporaryDelegations, now),
    [propEvents, approvers, temporaryDelegations, now],
  );

  const visibleEvents = useMemo(
    () => filterDelegationAuditTrailByAddress(events, addressFilter),
    [events, addressFilter],
  );

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600" />
            {title}
          </h2>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <input
          type="text"
          value={addressFilter}
          onChange={(e) => setAddressFilter(e.target.value)}
          placeholder="Filter by address or identifier"
          aria-label="Filter delegation audit trail by address"
          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
        />
      </div>

      {visibleEvents.length === 0 ? (
        <div className="text-center py-6 text-xs text-gray-400 border border-dashed rounded-lg">
          {events.length === 0
            ? "No delegation activity recorded yet."
            : "No delegation activity matches this address."}
        </div>
      ) : (
        <ul
          data-testid="delegation-audit-trail-list"
          className="divide-y divide-gray-100 border rounded-lg overflow-hidden"
        >
          {visibleEvents.map((event) => {
            const Icon = EVENT_ICONS[event.type];
            return (
              <li
                key={event.id}
                data-testid={`delegation-audit-event-${event.id}`}
                className="flex items-start gap-3 p-3 text-xs"
              >
                <Icon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border font-medium ${EVENT_BADGE_STYLES[event.type]}`}
                    >
                      {delegationAuditEventLabel(event.type)}
                    </span>
                    <span className="text-gray-400">
                      {new Date(event.occurredAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-700">{event.summary}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
