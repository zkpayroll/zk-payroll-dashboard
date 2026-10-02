# Treasury Liquidity Reserve Monitoring

Shows operators, on the main dashboard, whether the treasury holds enough of the payroll asset to fund the next payroll run, and how far the balance is from the target reserve. Display only: it does not block, reserve, or move funds.

Issue: #630

## Where it lives

| Concern | Location |
| --- | --- |
| Thresholds, validation, reserve math, display formatters | `lib/treasury/liquidityReserve.ts` |
| Domain types | `types/treasury.ts` |
| Data loading, error and freshness state | `hooks/useTreasuryLiquidityReserve.ts` |
| Dashboard card | `components/features/dashboard/TreasuryLiquidityReserveCard.tsx` (mounted in `DashboardHome`) |
| Tests | `__tests__/treasury-liquidity-reserve.test.ts`, `__tests__/dashboard-treasury-liquidity-reserve.test.tsx` |

## What it shows

| Value | Meaning |
| --- | --- |
| Available balance | Balance free to fund payroll. Funds already reserved for locked runs are excluded. |
| Next payroll run | Amount the next scheduled run will disburse. |
| Reserve ratio | Balance as a percentage of the next run, rounded down, shown beside the target. |
| Coverage | Whole payroll runs of the same size the balance can fund. |
| Shortfall | Amount missing to pay the next run. Shown only when the status is Critical. |

## Statuses

| Status | Condition | What the operator sees |
| --- | --- | --- |
| **Healthy** | Balance is at or above the target reserve | Confirmation with the current ratio |
| **Low** | Balance covers the next run but is below the target | Amount to add to reach the target, link to **Fund treasury** |
| **Critical** | Balance is below the next run | Alert with the shortfall amount, link to **Fund treasury** |

Each status has its own icon and text label in addition to its colour. Critical is announced as an alert; the other statuses are polite status updates.

### Other states

| State | When | Behaviour |
| --- | --- | --- |
| Loading | First load has not settled | Spinner and "Checking treasury liquidity reserve…" |
| Error | Readings could not be loaded | Explanation and a **Try again** button. A previously shown status is removed rather than left on screen. |
| Invalid reading | Balance or next payroll amount is missing, negative, not a number, or has more than 7 decimals | Shown as an error naming the affected reading. Never reported as Healthy. |
| No payroll scheduled | Next payroll amount is zero or absent | Empty state with the balance and a link to the payroll schedule |
| Stale balance | Balance was last updated 15 minutes ago or more | Status still shown, with a note giving the age of the reading |
| Unknown age | Balance has no usable update time | Status still shown, with a note that it may be out of date |

## Thresholds and configuration

All thresholds are defined in `lib/treasury/liquidityReserve.ts`.

| Setting | Default | How to change |
| --- | --- | --- |
| Target reserve | `150` (% of the next payroll run) | Set `NEXT_PUBLIC_TREASURY_RESERVE_TARGET_PERCENT` |
| Critical threshold | `100` (% of the next payroll run) | Fixed: Critical means the next run cannot be paid |
| Stale after | 15 minutes | `DEFAULT_RESERVE_STALE_AFTER_MS`, or the `config` prop per card |

`NEXT_PUBLIC_TREASURY_RESERVE_TARGET_PERCENT` must be a whole number from `100` to `10000`. Any other value (empty, fractional, below 100) is ignored and the default of `150` is used, so a typo cannot loosen the threshold. It is a build-time public variable: rebuild or restart the dev server after changing it.

```bash
# .env.local — require twice the next payroll run before reporting Healthy
NEXT_PUBLIC_TREASURY_RESERVE_TARGET_PERCENT=200
```

## Data source

Readings come from the persisted treasury store (`stores/treasury.ts`) for one asset, USDC by default:

| Reading | Store field |
| --- | --- |
| Balance | `balances[asset].available` |
| Next payroll run | `balances[asset].projected` |
| Last updated | `lastUpdated` |

The dashboard has no on-chain or API balance source yet, so **Refresh** re-reads the store. When one is added, pass it as `loadSnapshot` and nothing else needs to change:

```tsx
<TreasuryLiquidityReserveCard
  assetCode="USDC"
  loadSnapshot={async (assetCode) => fetchTreasurySnapshot(assetCode)}
/>
```

## Developer notes

- `evaluateTreasuryLiquidityReserve(snapshot, config?, now?)` is pure and takes the clock as an argument, so it can be tested without a DOM, store, or timers.
- Amounts are accepted as `number` or decimal `string` and converted to integer base units (7 decimals, Stellar's precision). Comparisons, the shortfall, and the ratio are computed on integers; results are returned as decimal strings.
- Validation messages never include the raw reading.
