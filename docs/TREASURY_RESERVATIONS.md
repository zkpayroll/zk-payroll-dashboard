# Treasury Reservations Component Suite

This document describes the treasury reservation component architecture, guidance evaluation model, user flows, lifecycle events, operational recovery mechanisms, and zero-knowledge privacy protections.

Issues: #887, #890

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

## Zero-Knowledge & Privacy Preservation

To uphold strict privacy and zero-knowledge compliance:

- **No Employee PII**: Individual employee IDs (`emp_*`), full names, emails, and wallet addresses are strictly excluded from reservation badges, timelines, warnings, and error messages.
- **Aggregated Operational Data**: Reservations surface only public batch identifiers (e.g. `BATCH-ALPHA`), currency codes (`USDC`), aggregate totals, and authorized system/operator roles.
