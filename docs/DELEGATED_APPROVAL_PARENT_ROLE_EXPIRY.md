# Delegated approval expires with its parent role (#778)

## Behavior

A delegated approval is granted under a parent role — the role whose
authority the delegation derives from (for example, the Admin role that
added a standing approver, or the standing approver that scheduled a
temporary delegation). When that parent role lapses or is revoked, the
delegated approval lapses **with it**, even if its own window has not run
out yet.

The effective expiry of a delegated approval is the earliest of:

- its own expiry (standing approvers: `addedAt` + approval window,
  default 24h; temporary delegations: `expiresAt`), and
- its parent role grant's expiry (or revocation time).

## Warning states

| Parent role state | Result |
|---|---|
| Outlives the approval, or no parent recorded | No warning; own window governs (fail-open). |
| Expires at or before the approval's own expiry | Amber warning `DELEGATED_APPROVAL_EXPIRES_WITH_PARENT_ROLE`: "This delegated approval expires with its parent role (…)" — equality counts, because at that instant the parent is what ends the approval. |
| Revoked | Red warning `DELEGATED_APPROVAL_PARENT_ROLE_REVOKED`: the approval is already expired regardless of its own window. |
| Expiry missing / unparseable | No warning; own window governs (fail-open). |

## Where it surfaces

- `components/features/approvals/TemporaryApproverDelegationPanel.tsx` —
  per-delegation warning plus a summary banner when any delegation is
  affected.
- `components/features/approvals/DelegatedApproverPanel.tsx` —
  per-approver warning under the approval's own expiry line.

## Implementation

- `lib/payroll/delegatedApprovalExpiry.ts` — pure resolver
  `resolveDelegatedApprovalParentExpiry(ownExpiresAt, parent, now)`.
  The parent grant is `ParentRoleGrant` (`roleLabel`, optional
  `expiresAt`, `revoked`, `revokedAt`).
- `stores/delegatedApprovers.ts` — optional `parentRole` on
  `DelegatedApprover` and `TemporaryDelegation`, passed through by
  `addApprover` / `addTemporaryDelegation`. Existing records without a
  parent role behave exactly as before.
- Tests: `__tests__/delegated-approval-parent-role-expiry.test.ts`
  (resolver: success / revoked / boundary) and
  `__tests__/delegated-approval-parent-role-warning.test.tsx` (panels).

## Privacy

Warnings name only the parent role label and timestamps. They never
include payroll amounts, employee data, or wallet contents.
