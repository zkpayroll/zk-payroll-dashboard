/**
 * Payroll responsibility delegation audit (#681).
 *
 * `stores/delegatedApprovers.ts` tracks standing approvers and time-boxed
 * temporary delegations, but nothing surfaces *when* delegated responsibility
 * actually changed hands — who was granted or revoked approval authority, and
 * when. Reviewers and auditors need a chronological trail of those events to
 * answer "who could approve payroll during this window, and who put them
 * there", separate from the live delegation list (which only shows current
 * state).
 *
 * This module is a pure projection: it derives audit events from the
 * delegation state already recorded by the store, so it never needs its own
 * persisted log and can't drift out of sync with the delegations it
 * describes. Privacy-safe: only delegate addresses/labels, actors, and
 * timestamps are surfaced — never payroll amounts or employee data.
 */

import type { DelegatedApprover, TemporaryDelegation } from "@/stores/delegatedApprovers";

export type DelegationAuditEventType =
  | "approver_added"
  | "temporary_delegation_scheduled"
  | "temporary_delegation_revoked"
  | "temporary_delegation_expired";

export interface DelegationAuditEvent {
  id: string;
  type: DelegationAuditEventType;
  /** The delegate address or identifier this event concerns. */
  address: string;
  label?: string;
  /** Who performed the action that produced this event, when known. */
  actor?: string;
  /** ISO timestamp the event occurred (or, for expiry, became true). */
  occurredAt: string;
  /** Privacy-safe, human-readable summary for the audit list. */
  summary: string;
}

const EVENT_LABELS: Record<DelegationAuditEventType, string> = {
  approver_added: "Standing approver added",
  temporary_delegation_scheduled: "Temporary delegation scheduled",
  temporary_delegation_revoked: "Temporary delegation revoked early",
  temporary_delegation_expired: "Temporary delegation expired",
};

/** Human label for an audit event type, exposed for the panel and tests. */
export function delegationAuditEventLabel(type: DelegationAuditEventType): string {
  return EVENT_LABELS[type];
}

function describeAddress(address: string, label?: string): string {
  const shortAddress =
    address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
  return label ? `${label} (${shortAddress})` : shortAddress;
}

/**
 * Builds a chronological delegation audit trail from standing approvers and
 * temporary delegations. Newest first, since that's what a reviewer checking
 * "what changed recently" wants to see without scrolling.
 *
 * `now` lets a temporary delegation that has silently lapsed (nobody called
 * `revokeTemporaryDelegation`) still show up as an "expired" event, rather
 * than looking like it's still active forever just because expiry isn't a
 * mutation the store ever records.
 */
export function buildDelegationAuditTrail(
  approvers: DelegatedApprover[],
  temporaryDelegations: TemporaryDelegation[],
  now: number = Date.now(),
): DelegationAuditEvent[] {
  const events: DelegationAuditEvent[] = [];

  for (const approver of approvers) {
    events.push({
      id: `audit_${approver.id}_added`,
      type: "approver_added",
      address: approver.address,
      label: approver.label,
      actor: approver.addedBy,
      occurredAt: approver.addedAt,
      summary: `${describeAddress(approver.address, approver.label)} was added as a standing approver${
        approver.addedBy ? ` by ${approver.addedBy}` : ""
      }.`,
    });
  }

  for (const delegation of temporaryDelegations) {
    events.push({
      id: `audit_${delegation.id}_scheduled`,
      type: "temporary_delegation_scheduled",
      address: delegation.address,
      label: delegation.label,
      actor: delegation.createdBy,
      occurredAt: delegation.createdAt,
      summary: `${describeAddress(delegation.address, delegation.label)} was granted a temporary delegation${
        delegation.createdBy ? ` by ${delegation.createdBy}` : ""
      } (${delegation.startsAt} – ${delegation.expiresAt}).`,
    });

    if (delegation.revokedAt) {
      events.push({
        id: `audit_${delegation.id}_revoked`,
        type: "temporary_delegation_revoked",
        address: delegation.address,
        label: delegation.label,
        occurredAt: delegation.revokedAt,
        summary: `${describeAddress(delegation.address, delegation.label)}'s temporary delegation was revoked before it expired.`,
      });
    } else {
      const expiresAtMs = new Date(delegation.expiresAt).getTime();
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= now) {
        events.push({
          id: `audit_${delegation.id}_expired`,
          type: "temporary_delegation_expired",
          address: delegation.address,
          label: delegation.label,
          occurredAt: delegation.expiresAt,
          summary: `${describeAddress(delegation.address, delegation.label)}'s temporary delegation expired.`,
        });
      }
    }
  }

  return events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

/** Narrows the trail to events concerning one delegate address (case-insensitive). */
export function filterDelegationAuditTrailByAddress(
  events: DelegationAuditEvent[],
  address: string,
): DelegationAuditEvent[] {
  const normalized = address.trim().toLowerCase();
  if (!normalized) return events;
  return events.filter((event) => event.address.toLowerCase() === normalized);
}
