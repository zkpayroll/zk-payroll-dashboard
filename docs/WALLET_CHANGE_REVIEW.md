# Wallet Change Review Card

This guide describes the employee wallet change review surface used before payroll is distributed to a new destination. It is written for managers, admins, and auditors who need to confirm a destination change without exposing full wallet addresses.

## Why the card exists

A Stellar destination change made between two payroll runs is a high-risk event. The review card makes that change visible, attributable, and actionable so that a reviewer can confirm or reject the new destination before the next payroll run executes.

## Where it renders

| Surface | File | Behaviour |
| ------- | ---- | --------- |
| Employee detail page (`/employees/[id]`) | `components/features/employees/EmployeeDetailPageContent.tsx` | Renders directly under the employee header whenever a rotation request exists for that employee. |
| Employee directory drawer | `components/features/employees/EmployeeDetail.tsx` | Renders at the top of the slide-over drawer used from the employee directory. |
| Review card component | `components/review/WalletChangeReviewCard.tsx` | The shared implementation. It reads `stores/walletRotation.ts` by default and accepts explicit props for isolated rendering. |

The card renders nothing when the employee has no rotation request, or when the request has reached a terminal state (`rejected`, `completed`, `failed`).

## Component states

| State | Trigger | What the reviewer sees |
| ----- | ------- | ---------------------- |
| Loading | `isLoading` is true | Indigo panel with `role="status"` and the text `Loading wallet change details...`. |
| Error | `error` is a non-empty string | Red panel with `role="alert"` explaining that wallet change details could not be loaded. |
| Empty | No request, or a terminal request status | Nothing is rendered, so the page keeps its normal layout. |
| Pending review | `status: "pending"` | Amber review card with request provenance, masked destinations, a rejection reason field, and the **Confirm destination** / **Reject change** controls. |
| Cooldown or approved | `status: "cooldown"` or `"approved"` | Amber card without review controls and a `role="status"` confirmation message pointing at the cooldown. |
| Emergency change | `isEmergency` is true or `reasonCode: "emergency"` | Additional red **Emergency wallet change** flag above the description. |

## Review controls

- **Confirm destination** is always enabled for a pending request. Confirming moves the request to `cooldown` and pauses distribution until the cooldown completes.
- **Reject change** stays disabled until a rejection reason is entered. The reason is stored on the request as `rejectionReason`, the card unmounts, and the reason input is cleared.
- Request provenance (reason, requester, request date) is shown so the reviewer can validate the change against the change-management record.

## Privacy and redaction rules

The card must never place full wallet addresses, salary figures, or payroll totals into the DOM, logs, telemetry, or exports.

- Previous and new destinations are rendered through `maskAddress` from `stores/walletRotation.ts`, which keeps the first six and last four characters only.
- The reason label, requester name, and request date are the only non-address attributes displayed.
- Tests assert that neither the full previous nor the full new destination appears in the rendered output.

## Tests

Run the review card coverage with:

```bash
npx vitest run __tests__/wallet-change-review-card.test.tsx __tests__/employee-detail-wallet-change.test.tsx
```

The suite covers the successful rendering and confirmation path, loading and error propagation, the empty path for missing and rejected requests, the zero-control cooldown edge case, and the emergency flag.

## Related reading

- [Wallet signing recovery guide](./WALLET_SIGNING_RECOVERY_GUIDE.md)
- [Admin recovery guide](./ADMIN_RECOVERY_GUIDE.md)
