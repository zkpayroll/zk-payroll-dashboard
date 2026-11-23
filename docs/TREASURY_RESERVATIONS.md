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
