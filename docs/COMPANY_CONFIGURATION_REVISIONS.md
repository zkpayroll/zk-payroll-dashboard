# Company configuration revisions

The persisted company store records dashboard-local configuration revisions.
Company setup's existing `setCompany` path automatically establishes a baseline
and records later changes. Admin Overview (`/admin`) shows the
active company's newest revisions and changed field labels, never old/new values.
This is local observation history, not proof of authorization, an immutable audit
log, on-chain state, or a replacement for backend optimistic concurrency.

## Tracked configuration

The allowlist covers company name, admin and treasury wallets, active status,
network, token contract, all five payroll contracts and audit
settings. Employee counts, payroll values and unknown fields are not revision
inputs. Edited configuration never overwrites the current employee count.
Equivalent key order and unchanged saves do not create extra revisions. Removing
optional settings does.
Revision metadata contains no raw configuration values. The latest allowlisted
snapshot is stored locally for comparison, separately from revision metadata.

Histories are isolated by company ID, survive switching/clearing the active
company and persist through reloads. Selecting a previously observed company
never manufactures an edit. The first observation is labelled as a baseline,
not an assertion about when the company was created. Older company-only storage
is still readable; the next save establishes its first observed revision.
The newest 50 entries per company are retained, with monotonically increasing
versions even when older entries are removed. Clearing browser storage clears
this local history. No server API or new dependency is required.

## Saving edited configuration

Existing setup and selection APIs remain compatible. New configuration editors
should read the active company's latest revision number (0 before a baseline)
and call `useCompanyStore.getState().updateConfiguration(config, expectedRevision)`.
The synchronous action returns `{ ok: true, version }` or
`{ ok: false, code, message }`. Display its actionable message and retain the
unsaved draft on failure. A `conflict` requires reloading/reviewing the current
company and revision, not blindly retrying with a new version number.

Validated edits require a nonempty name/ID, distinct well-formed Stellar admin
and treasury addresses, supported network values and valid optional audit
settings. A base setup profile may omit both network and contracts; supplying
either requires the network and all five valid contract IDs together. Validation
or stale-revision failures leave both configuration and history unchanged.
Unchanged successful saves return the existing revision number.

The conflict check coordinates edits within this store instance only. It does
not authenticate wallets or arbitrate simultaneous writes across tabs/devices.
A future shared persistence API must enforce its own atomic revision check.
Legacy `setCompany` remains a compatibility ingestion path, not a validated edit
or authorization API; do not use it to bypass editor conflict checks.

## Local verification

Run `npm test -- __tests__/company-configuration-revisions.test.ts
__tests__/company-configuration-revisions.test.tsx
__tests__/company-switcher.test.tsx`, `npm run typecheck` and `npm run lint`.
Check Admin Overview on desktop and mobile for the unselected, empty-baseline
and populated states; only the active company's changed field names should show.
