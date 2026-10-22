# Payroll Operations Health Score

Gives operators, on the main dashboard, a single 0-100 score for how payroll operations are running, a status band, and the factors that lowered the score with a link to fix each one. Display only: it does not block, retry, or change any run.

Issue: #738

## Where it lives

| Concern | Location |
| --- | --- |
| Scoring rules, validation, types | `lib/payroll/operationsHealth.ts` (`scorePayrollOperationsHealth`) |
| Dashboard card | `components/features/dashboard/DashboardPayrollOperationsHealthCard.tsx` (mounted in `DashboardHome`) |
| Tests | `__tests__/lib/payroll/operationsHealth.test.ts`, `__tests__/components/dashboard-payroll-operations-health.test.tsx` |

The card reads payroll runs from the dashboard's payroll run data and the treasury balance (`available`) and next run amount (`projected`) from the treasury store. Each input can be overridden through props.

## Scoring rules

The score starts at 100 and is evaluated over the 10 most recent runs. It never goes below 0.

| Factor | Deduction | Severity |
| --- | --- | --- |
| Failed run | 15 each, max 45 | Critical when 3 or more fail or at least half of settled runs fail, otherwise Warning |
| Pending run older than 72 hours | 10 each, max 30 | Warning |
| Paused run | 10 each, max 20 | Warning |
| Non-cancelled run with a mismatched or failed reconciliation | 5 each, max 15 | Warning |
| Treasury balance below the next run | 35 | Critical |
| Treasury balance below 150% of the next run | 10 | Warning |
| Funding data missing or invalid | 0 | Info |

Cancelled runs are not penalised. When no next run is scheduled (amount 0), funding is not scored.

## Bands

| Band | Condition |
| --- | --- |
| **Healthy** | Score 80 or above and no Warning or Critical factor |
| **Needs attention** | Score 50-79, or any Warning factor |
| **Critical** | Score below 50, or any Critical factor |

Each band has its own icon and text label in addition to its colour. Critical is announced as an alert; other states are polite status updates. The card lists the three most impactful factors and says how many more exist.

## Invalid and missing data

| Situation | Behaviour |
| --- | --- |
| No runs recorded | **Insufficient data** state with no score. Never reported as Healthy. |
| Run with an unknown status or invalid timestamp | Excluded from the score and listed under **Data issues** |
| All runs invalid | **Insufficient data** state with the data issues listed |
| Treasury balance or next run amount missing, negative, or not a number | Funding excluded from the score, with an Info factor and a data issue explaining why |

Thresholds can be adjusted through the optional `config` argument (`lookbackRuns`, `stalePendingHours`, `fundingBufferPercent`).
