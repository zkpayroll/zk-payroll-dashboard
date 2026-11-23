# Organization settings validation history

The dashboard keeps a privacy-safe, capped history of organization settings validation runs so operators can see when payroll configuration was last checked, whether the check passed, and which checks failed.

## Where it lives

- Implementation: `src/settings/validationHistory.ts`
- Tests: `__tests__/settings-validation-history.test.ts`
- It builds on the existing validator `validateCompanyConfig` (`lib/validateCompanyConfig.ts`), which is the same flow used by the settings health checker and the `useCompanyConfigValidation` hook. No existing validation flow was modified.

## API

### `recordSettingsValidation(history, validation, options?)`

Appends a new entry to the history and returns a result object — it never throws:

- Success: `{ ok: true, entry, history }` where `history` is a new array with `entry` prepended and capped at `MAX_SETTINGS_VALIDATION_HISTORY` (50) entries. The caller decides where to store the returned array.
- Failure: `{ ok: false, error }` with an actionable message following the `[Action] failed: [reason]. [Next step].` copy pattern.

Inputs are validated at runtime:

| Input problem | Error message ends with |
| --- | --- |
| `history` is not an array | `Reload the settings page to restore history.` |
| `validation.checks` is missing or not an array | `Re-run organization settings validation and try again.` |
| A check is missing `id`, `label`, `message`, or has an unknown `status` | `Re-run organization settings validation and try again.` |
| `options.now()` returns an invalid date | `Check the system clock and try again.` |

Options:

- `companyId` — organization that owns the run; defaults to `"unknown"`.
- `now` — injectable clock (`() => Date`) for deterministic tests.

### `getSettingsValidationHistoryStats(history)`

Returns `{ total, passed, failed, lastValidatedAt, lastStatus }`. New entries are prepended, so index `0` is the latest run. An empty history returns zero counts and `null` for the last run.

### Entry shape

```ts
interface SettingsValidationHistoryEntry {
  id: string; // svh_<epoch>_<random>
  companyId: string;
  validatedAt: string; // ISO-8601 timestamp
  status: "passed" | "failed";
  errorCount: number;
  warningCount: number;
  failedChecks: { id: string; label: string; message: string }[];
}
```

A run is `failed` when at least one check has status `error`; warnings alone do not fail a run.

## Privacy guarantees

Entries store only check identifiers, labels, messages, counts, and timestamps. Wallet addresses, salary figures, employee data, and contract secrets never enter an entry, so history is safe to render, export, and log. The test suite asserts that serialized history contains no addresses or salary fields.

## Retention

History is capped at the newest 50 entries. Recording beyond the cap silently drops the oldest entries; no other trimming or persistence happens in this module.

## Usage

```ts
import {
  recordSettingsValidation,
  getSettingsValidationHistoryStats,
} from "@/src/settings/validationHistory";
import { validateCompanyConfig } from "@/lib/validateCompanyConfig";

const result = recordSettingsValidation(history, validateCompanyConfig(config), {
  companyId: config.id,
});

if (result.ok) {
  history = result.history;
} else {
  toast.error(result.error);
}

const stats = getSettingsValidationHistoryStats(history);
```

## Tests

`__tests__/settings-validation-history.test.ts` covers the success path, the failing-validation path, runtime input errors (missing checks, malformed check, bad clock, non-array history), the retention cap edge case, empty-history stats, and the privacy invariant.
