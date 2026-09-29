# Payroll Timezone Display Preference

Lets admins choose how payroll **schedule times** are displayed across the dashboard: **local time**, **organization time**, or **UTC**. Display only — settlement windows, execution logic, and stored timestamps are unaffected and remain UTC-normalized.

Issue: #292

## Where it lives

| Concern | Location |
| --- | --- |
| Display modes, IANA validation, zone resolution, formatters | `lib/payroll/timezoneDisplay.ts` |
| Persisted admin preference (localStorage via Zustand `persist`) | `stores/timezonePreference.ts` (key `zk-payroll-timezone-display`) |
| Admin settings UI | `components/timezone/TimezoneDisplayPreference.tsx` |
| Settings pages | `app/settings/timezone/page.tsx` (dedicated) and `app/settings/schedule/page.tsx` (inline panel) |
| React binding for consumers | `hooks/usePayrollZoneFormatter.ts` |
| Wired example | `RecurringPayrollTemplateEditor` "Next:" schedule line renders date + time + zone label |

## Admin usage

1. Go to **Settings → Timezone Display** (or open **Settings → Payroll Schedule**, the panel sits above the calendar).
2. Pick a mode:
   - **My local time** — each viewer sees times in their device timezone.
   - **Organization time** — everyone sees the configured IANA zone (e.g. `Europe/Berlin`). Choose it in the "Organization timezone" select.
   - **UTC** — default; matches the pre-feature behavior.
3. The **Preview** line shows a fixed sample schedule time in the effective zone with a zone label (e.g. `Jan 15, 2026, 3:30 PM GMT+1`).
4. The preference is stored locally on the device (like other admin settings); it does not sync between browsers.

### Clear, actionable feedback

- Invalid mode or an unpersisted bogus zone → inline error: “Choose a valid display mode…”.
- Switching to organization mode **before** setting an organization zone → error: “Set an organization timezone before switching to organization time.” The mode does not change.
- Hand-edited/corrupt persisted zone with organization mode → the preview shows times in UTC with an explicit “falling back to UTC until an organization timezone is set” note.

## Developer notes

To display a payroll schedule time in the admin-selected zone:

```tsx
const { formatZoneAware } = usePayrollZoneFormatter();
formatZoneAware(template.nextScheduled); // "Jan 15, 2026, 9:30 AM EST"
```

Rules:

- Use `resolveDisplayTimeZone()` / `formatInDisplayZone()` instead of ad-hoc `toLocaleTimeString` for schedule times so the zone label is always included.
- Keep date-only calendar bucketing (`lib/date/scheduleWindows.ts`, `formatPayrollDate`) UTC-normalized — display preference must never shift a date key.

## QA steps

Automated: `npx vitest run __tests__/lib/payroll/timezoneDisplay.test.ts __tests__/timezone-preference-store.test.ts __tests__/components/TimezoneDisplayPreference.test.tsx`

- **Success**: select Organization time + `Europe/Berlin` → preview shows `3:30 PM … GMT+1`; reload persists the choice (localStorage).
- **Failure**: set an invalid zone (e.g. `Bad/Zone`) → alert “not a valid IANA timezone” and the previous zone is kept; clicking the organization radio with an unset zone is blocked with a guidance error.
- **Edge**: persisted invalid zone + organization mode → display falls back to UTC and says so; invalid date input formats to `—`.

## Privacy

The preference stores only a display mode and an IANA timezone identifier. Sample preview times are fixed constants. No payroll amounts, employee identities, or run data are read, logged, exported, or persisted by this feature; store actions never write to telemetry or audit events.
