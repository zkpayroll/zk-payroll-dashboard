# Treasury reservation UI behavior

This document defines how treasury reservations behave on the `/treasury` page.
A reservation is an aggregate, local UI hold for the next payroll run. It does
not transfer funds, change the on-chain balance, or lock payroll execution.

## Expected behavior

- The reservation amount defaults to the aggregate projected payroll amount.
- Reserving funds marks the treasury as reserved and shows both the reserved
  amount and the amount still available after the reservation.
- Updating a reservation replaces the previous amount. It never adds a second
  hold on top of the existing one.
- Releasing a reservation clears the hold and restores the default amount.
  The release action is disabled when nothing is reserved.
- Reservation state is local to the current treasury view. A page reload clears
  it.
- The page never displays employee names, individual salaries, or per-person
  amounts. Only aggregate treasury totals are rendered.

## UI states

| State | Trigger | Status badge | Status message |
| ----- | ------- | ------------ | -------------- |
| Idle | Initial render or release | `No reservation` | `No funds are reserved for the next payroll run.` |
| Active | Valid reserve or update | `Reserved` | `Funds are reserved for the next payroll run.` |
| Error | Invalid amount or insufficient balance | `Not updated` | See [Validation and errors](#validation-and-errors) |

Dynamic status messages use `aria-live="polite"`. Errors are exposed with
`role="alert"`. The reserved and available amounts are labelled as a definition
list so screen readers announce them with their context.

## Validation and errors

A reservation amount must be finite, greater than zero, and no larger than the
current treasury balance.

| Scenario | User-facing message |
| -------- | ------------------- |
| Empty, zero, negative, or non-finite amount | `Enter a valid amount greater than zero. No funds were reserved.` |
| Amount exceeds treasury balance | `Reservation failed: the amount exceeds the available treasury balance. Reduce the amount or add funds, then retry.` |

Errors name the action and the next step. They do not reveal employee or salary
data, and they do not silently clamp an invalid amount. When an update fails,
the previous reservation remains unchanged.

## Boundary cases

- Reserving exactly the full balance is allowed. Available after reservation
  is `$0`.
- An invalid update keeps the existing reservation and shows the error message.
- Releasing an idle reservation is disabled.
- Amounts are formatted consistently as USD aggregates, for example `$19,500`.

## Public API

The behavior is implemented in `lib/treasury/reservation.ts`. Its exported
types and helpers are the public contract for other dashboard modules:

- `TreasuryReservationStatus`
- `TreasuryReservationInput`
- `TreasuryReservationState`
- `updateTreasuryReservation`
- `releaseTreasuryReservation`
- `validateReservationAmount`
- `getUnreservedAmount`
- `formatReservationAmount`

## Verification

Focused tests live in `__tests__/treasury-reservations.test.tsx` and cover the
pure helpers plus the rendered component: successful reservation, insufficient
balance, invalid amounts, full-balance boundary, update, and release. Run them
with `npm test -- treasury-reservations`.
# Treasury Reservations Component Suite

This document describes the treasury reservation component architecture, guidance evaluation model, user flows, lifecycle events, operational recovery mechanisms, and zero-knowledge privacy protections.

Issues: #887, #889, #890

## Architecture Overview

Treasury reservations guarantee that funds earmarked for approved payroll runs are protected from double-allocation and overdrafts before on-chain execution.

| Concern | Location |
| --- | --- |
| Treasury Page | `app/treasury/page.tsx` |
| Treasury View Component | `components/features/treasury/TreasuryView.tsx` |
| Reservation Guidance Card | `components/features/treasury/TreasuryReservationGuidanceCard.tsx` |
| Reservation Guidance Evaluator | `lib/treasury/reservationGuidance.ts` |
| Guidance Domain Re-export | `src/treasury/reservationGuidance.ts` |
| Public Guidance Types | `types/treasury.ts` |
| Expiry Warning & Actions | `components/features/treasury/ReservationExpiryWarning.tsx` |
| Reservation Timeline | `components/features/treasury/ReservationTimeline.tsx` |
| Toast Announcements | `components/features/treasury/ReservationToastListener.tsx` |
| Reservations Store | `stores/reservations.ts` |
| Recovery Planner & Runner | `lib/treasury/reservationRecovery.ts` |
| Recovery Flow Tests | `__tests__/treasury-reservation-recovery.test.tsx` |
| Event Emitters & Log | `lib/events/reservationEvents.ts` |
| Guidance Unit Tests | `__tests__/treasury-reservation-guidance.test.ts` |
| Guidance Card Tests | `__tests__/components/TreasuryReservationGuidanceCard.test.tsx` |
| Component Tests | `__tests__/treasury-reservations.test.tsx` |

## Structured Reservation Guidance (`#887`)

`evaluateTreasuryReservationGuidance` (`lib/treasury/reservationGuidance.ts`) inspects treasury balances, projected payroll obligations, configured payroll assets, active/warning/expired locks, and permission flags (`canRefresh`, `canRevalidate`, `canCancel`) using exact 7-decimal `BigInt` stroop arithmetic (avoiding floating-point drift) and outputs prioritized, privacy-safe guidance rendered by `TreasuryReservationGuidanceCard`:

| Reason Code | Tone | Trigger Condition | Operator Next Steps |
| --- | --- | --- | --- |
| `ASSETS_UNCONFIGURED` | `blocked` | No supported payroll assets configured | Enable a Stellar payroll asset in Asset Settings |
| `INVALID_TREASURY_DATA` | `blocked` | Negative, missing, or malformed balance, amount, or timestamp | Refresh balances and revalidate or cancel corrupted locks |
| `INSUFFICIENT_TREASURY_BALANCE` | `blocked` | Projected payroll exceeds available treasury balance | Top up treasury balance before reserving or executing |
| `OVER_RESERVATION_BLOCKED` | `blocked` | Active reservations for the asset exceed available balance | Cancel stale holds or deposit additional liquidity |
| `RESERVATION_EXPIRED_LOCKED` | `blocked` | Expired lock has refresh and revalidate disabled | Cancel non-renewable expired lock and create a new one, or escalate to an admin |
| `RESERVATION_EXPIRED_BLOCKED` | `blocked` | One or more locks passed `expiresAt` with renewal enabled | Use **Refresh** or **Revalidate** below before settlement |
| `RESERVATION_EXPIRING_SOON` | `warning` | No expired locks, at least one lock inside the 5-minute window | Execute promptly or click **Refresh** to extend TTL |
| `RESERVATION_LIQUIDITY_TIGHT` | `warning` | Unreserved liquidity is below the next lock size or safety buffer | Execute existing locks or free unused reservations before adding more |
| `NO_ACTIVE_RESERVATIONS` | `info` | Zero reservations currently tracked | Click **Reserve Funds** to lock funds prior to payroll settlement |
| `RESERVATIONS_HEALTHY` | `ready` | All active locks healthy and backed by unreserved balance | Proceed to payroll execution while TTL remains valid |

## Security, Fail-Closed & Privacy Guarantees

1. **Fail-Closed Expiry & TTL Bounds (`stores/reservations.ts`):** `getReservationStatus` and `getTimeRemaining` fail closed to `"expired"` and `0` ms whenever timestamps or clock inputs are invalid (`NaN`), and `resolveSafeTtlMs` caps renewals at `MAX_RESERVATION_TTL_MS` (24 hours) to prevent timestamp overflow.
2. **Dynamic Amount & Over-Reservation Guard (`TreasuryView.tsx`):** `handleReserveFunds` validates user-entered reservation amounts (positive, max 2 decimals, within funds available after projected obligations) and checks cumulative unreserved liquidity in 7-decimal `BigInt` stroops so repeated reservation requests cannot lock more funds than available.
3. **Bounded Redaction (`sanitizeReservationIdentifier`):** Public batch IDs, asset codes, and toast descriptors strip zero-width/BiDi override characters and redact accidental Stellar StrKeys/muxed addresses, `emp_*` IDs, emails, JWTs, URL tokens, and commitment hashes across visible text and `title` attributes before final length capping.

## Reservation States & Health Status

Reservations transition across well-defined states based on time-to-live (`RESERVATION_TTL_MS = 15 minutes`) and warning windows (`RESERVATION_WARNING_WINDOW_MS = 5 minutes`):

| Health Status | Condition | Operator Experience | Contract Execution |
| --- | --- | --- | --- |
| **Healthy** | More than 5 minutes until expiration | Green status badge, live countdown timer, Refresh / Revalidate / Cancel actions | Permitted |
| **Expiring Soon** | 5 minutes or less until expiration | Amber status badge ("Expiring soon"), countdown warning | Permitted |
| **Expired** | Expiration timestamp reached or passed | Red alert banner ("Expired reservations block execution"), clamped "Expired" countdown | Blocked |

## User Actions & Recovery Flows

1. **Reserve Funds (Creation)**
   - Triggered via the **Reserve Funds** button in the treasury funding actions.
   - Verifies that available balance covers projected payroll.
   - Emits a privacy-safe `FundingReservationCreatedEvent` and appends a `created` event to the `ReservationTimeline`.
   - Registers the reservation in `useReservationsStore`.
   - Shows an accessible toast confirmation with the reservation ID.

2. **Insufficient Funds Guard**
   - If projected payroll exceeds balance, clicking **Reserve Funds** triggers an actionable alert banner.
   - Prevents unbacked reservations without exposing employee salary details.

3. **Refresh**
   - Extends reservation expiry by a fresh 15-minute TTL window (`refreshReservation(id)`).
   - Clears any blocking alert banner once all reservations are healthy.

4. **Revalidate**
   - Updates `reservedAt` to the current timestamp and extends `expiresAt`.

5. **Cancel**
   - Removes the reservation from active tracking (`cancelReservation(id)`).
   - If no reservations remain, returns to the empty state guidance banner.

## Recovery Flow (`#889`)

`lib/treasury/reservationRecovery.ts` decides what an operator should do to
unblock each reservation and reports the outcome of every recovery attempt.

### Recovery plan

`getReservationRecoveryPlan(reservation, now)` returns the reservation status,
whether it blocks execution, each action's availability (with an actionable
`disabledReason`), and one recommendation:

| Situation | Recommendation |
| --- | --- |
| Healthy lock | `none` |
| Expiring or expired, Refresh allowed | `refresh` |
| Expiring or expired, only Revalidate allowed | `revalidate` |
| Expiring soon, no renewal allowed | `execute` (run payroll before expiry) |
| Expired, no renewal allowed, Cancel allowed | `cancel` |
| Expired, every action disabled | `escalate` (treasury administrator) |

Fail-closed rules:

- Malformed amount, asset, or timestamp counts as expired and blocks execution.
- Refresh and Revalidate are **never** offered for a corrupt amount or asset.
  Renewing would revive an unusable lock, so the operator is steered to Cancel.
- A timestamp-only defect can still be repaired with Refresh or Revalidate.
- Permission flags must be exactly `true`; any other value counts as disabled.

`summarizeReservationRecovery(reservations, now)` returns how many locks block
execution, how many can be recovered from this screen, and how many need an
administrator. The expired banner shows this as recovery progress.

### Action results

Store actions (`refreshReservation`, `revalidateReservation`,
`cancelReservation`) return a `ReservationActionResult` instead of silently
doing nothing:

```ts
type ReservationActionResult =
  | { ok: true; action; reservationId }
  | { ok: false; action; reason: "invalid_id" | "not_found" | "not_permitted" | "invalid_data" };
```

`runReservationRecoveryAction(action, id)` is the UI entry point. It adds the
`invalid_data` guard and records successful actions on the reservation
timeline. Timeline entries contain no amounts.

### Operator messages

`describeReservationActionResult(result)` produces the message shown in the
`reservation-recovery-outcome` live region (`role="status"` on success,
`role="alert"` on failure):

| Outcome | Message |
| --- | --- |
| Refresh succeeded | Reservation refreshed. A new 15-minute execution window is active. |
| Revalidate succeeded | Reservation revalidated. Its reservation window was re-anchored to now for 15 minutes. |
| Cancel succeeded | Reservation cancelled and its hold released. Create a new reservation before executing payroll. |
| `invalid_id` | … has no valid identifier. Reload treasury state, then retry. |
| `not_found` | … is no longer tracked in this session … Reload treasury state, then retry. |
| `not_permitted` | … is not permitted for this reservation. Use another available recovery action or contact a treasury administrator. |
| `invalid_data` | … has an invalid amount or asset and cannot be renewed. Cancel it and create a new reservation. |

Messages name the action and the next step only. They never include amounts,
batch identifiers, employee data, or wallet addresses.

### UI behavior (`ReservationExpiryWarning`)

- The recommended action is highlighted (`data-recommended="true"`), and each
  action group exposes `data-recommendation`.
- Disabled actions are explained under the buttons and linked through
  `aria-describedby`.
- Each attempt is reported in the live outcome region and through the optional
  `onRecoveryAction(result)` callback.

## Zero-Knowledge & Privacy Preservation

To uphold strict privacy and zero-knowledge compliance:

- **No Employee PII**: Individual employee IDs (`emp_*`), full names, emails, and wallet addresses are strictly excluded from reservation badges, timelines, warnings, and error messages.
- **Aggregated Operational Data**: Reservations surface only public batch identifiers (e.g. `BATCH-ALPHA`), currency codes (`USDC`), aggregate totals, and authorized system/operator roles.
