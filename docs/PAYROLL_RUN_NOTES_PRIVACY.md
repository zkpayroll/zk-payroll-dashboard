# Payroll run notes: privacy rules

Operational notes let admins leave handoff context on a payroll run. They must
never hold private payroll values.

## Who can write

- Only `admin` can add or remove notes. `operator` and `auditor` see a read-only
  panel that states the reason.
- Notes are refused on `cancelled` and `failed` runs.

## What is refused

A note is rejected when it contains any of these categories:

| Category | Examples | Finding label |
| --- | --- | --- |
| `compensation` | `$4,000`, `48200`, `1200 USDC`, "salary" next to a figure | Salary or payment amount |
| `employee_identity` | roster names, emails, wallet addresses, `emp_001` | Employee personal data |
| `credential` | seed phrase, API key, password, 0x-prefixed 40+ hex | Credential or secret |

Dates, `YYYY-MM-DD`, `YYYYMMDD` batch references and clock times are allowed.
Keywords such as "bonus run" or "compensation review" are allowed unless a
figure sits next to them.

Length is checked before privacy. Notes are limited to 280 characters.

## What is never shown or stored

- Rejection messages name the category only. They never repeat the matched text.
- `lastError`, the note store and audit entries hold metadata only.
  Audit entries record run id, note id, author role, character count and timestamp.
- Notes are kept in memory for the session. They are not written to
  `localStorage`, logs, telemetry or exports.

## For contributors

- Rules live in `lib/privacy/runNotes.ts` (scanner) and `src/payroll/runNotes.ts`
  (validator and role/status rules). Do not add `console` or telemetry calls
  that take a note body.
- Any new export or audit view must use `buildRunNoteAuditEntry` and omit `body`.
- Tests: `__tests__/payroll-run-notes-rule.test.ts`,
  `__tests__/payroll-run-notes-panel.test.tsx`,
  `__tests__/payroll-run-notes-privacy-leak.test.ts`.
