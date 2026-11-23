# Reserved amount vs final payout

The reconciliation dashboard compares the amount reserved for a payroll run
with the run's final payout total, per asset.

## Input

`ReconciliationAssetAmount` has an optional `reserved` field. Leave it
`undefined` when no reservation data is available; the run is then not compared
and behaves exactly as before. `reserved` is a per-run figure and is not carried
into merged period or dashboard totals.

## Result

`compareReservedToPayout(assetCode, reserved, finalPayout)` returns one of:

| Status | Meaning | Effect on the run |
| --- | --- | --- |
| `matched` | Final payout equals the reservation. | None. |
| `over_reserved` | The reservation is larger than the payout; the excess should be released. | Health is at least `warning`. |
| `under_reserved` | The payout exceeds the reservation; part of it is unfunded. | A `mismatches` blocker is added and health is `blocked`. |
| `no_reservation` | There is a payout and no reservation figure. | Shown in the checks list only. |
| `invalid` | An amount is missing, negative, or not finite. | A `mismatches` blocker is added. |

Amounts are compared in units of 1e-7, so floating point noise is never
reported as a mismatch. Each asset is compared on its own; different assets are
never added together.

## Privacy

Only aggregate figures are accepted: one reserved total and one payout total per
asset. Messages contain the asset code and those totals, never an employee,
wallet address or individual payment.
