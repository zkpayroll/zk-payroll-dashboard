# Treasury Reservations Component Suite

This document describes the treasury reservation component architecture, user flows, lifecycle events, operational recovery mechanisms, and zero-knowledge privacy protections.

Issue: #890

## Architecture Overview

Treasury reservations guarantee that funds earmarked for approved payroll runs are protected from double-allocation and overdrafts before on-chain execution.

| Concern | Location |
| --- | --- |
| Treasury Page | `app/treasury/page.tsx` |
| Treasury View Component | `components/features/treasury/TreasuryView.tsx` |
| Expiry Warning & Actions | `components/features/treasury/ReservationExpiryWarning.tsx` |
| Reservation Timeline | `components/treasury/ReservationTimeline.tsx` |
| Toast Announcements | `components/features/treasury/ReservationToastListener.tsx` |
| Reservations Store | `stores/reservations.ts` |
| Event Emitters & Log | `lib/events/reservationEvents.ts` |
| Component Tests | `__tests__/treasury-reservations.test.tsx` |

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
