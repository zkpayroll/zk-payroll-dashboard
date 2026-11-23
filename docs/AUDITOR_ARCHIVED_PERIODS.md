# Auditor View of Archived Payroll Periods

Route: `/audit/archived-periods` (optional `?period=YYYY-MM`). Linked from the
Audit Grants page (`/audit`). Issue: #858.

## Behavior

- The role is read from `GET /api/auth/session`, the same source the company
  switcher uses. A role held only in client state cannot unlock the view.
- Auditor sessions see archived payroll runs grouped by pay period, newest
  first, with run id, employer, status, a shortened transaction hash,
  evidence bundle id, and per-period audit coverage
  (`available` / `partial` / `unavailable`).
- The view is read-only. It has no archive, restore, purge, or edit actions.
- Only runs with `isArchived: true` are in scope. A disputed or otherwise
  non-archived run is never listed, and requesting its period gives the same
  "no archived runs" message as any other period with no archived runs.
- Malformed records (no id, or a period not in `YYYY-MM` form) are skipped
  and counted, so one bad record does not hide the rest.

## Privacy

`lib/audit/auditorArchivedPeriods.ts` builds the view model from an allow
list. These fields are never copied onto it, so they cannot be rendered:

| Withheld field | Why |
| -------------- | --- |
| `totalAmount` | Aggregate salary amount |
| `employeeCount` | Combined with amounts, small headcounts identify pay |
| `notes` | Free text can name employees |
| `disputeReason` | Free text can describe individual pay |
| `archivedBy` | Wallet address of the archiving operator |

The table shows "Withheld" in the total column so auditors know the value
exists and was withheld on purpose.

## Refusals

Every refusal is static copy with a next step. None of them echoes payroll
data or unvalidated input.

| Code | When | Action |
| ---- | ---- | ------ |
| `SESSION_UNAVAILABLE` | 401 or an unknown role | Sign in again (`/login?redirect=…`) |
| `SESSION_CHECK_FAILED` | 5xx or network failure | Retry access check (in place) |
| `ROLE_NOT_AUDITOR` | Admin or operator session | Open Payroll Archive Center (`/archive/payroll-runs`) |
| `INVALID_PERIOD` | `period` is not `YYYY-MM` | View all archived periods |
| `PERIOD_NOT_ARCHIVED` | No archived runs for that period | View all archived periods |

## Tests

`__tests__/auditor-archived-periods-view.test.tsx` covers the success path,
role and session rejections, the retry flow, and boundary cases: an empty
archive, a non-archived period, malformed records, and period input with
whitespace or invalid characters.
