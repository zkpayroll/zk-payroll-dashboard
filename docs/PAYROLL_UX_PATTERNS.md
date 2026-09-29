# Payroll UX Patterns

Developer reference for the UX reliability patterns introduced in issues #455, #460, #462, #463, and #468–#471. Each section covers the motivation, the files involved, usage examples, and important design constraints.

---

## #470 — Payroll Run Progress Persistence

**Goal:** Restore visible batch progress after a refresh without exposing
sensitive payroll data.

### Files

| File | Purpose |
| --- | --- |
| `stores/payrollRunProgress.ts` | Zustand store with `persist` middleware. Holds a `PayrollRunProgressSnapshot`. |
| `hooks/usePayrollRunProgress.ts` | Syncs `usePayrollWizardStore` state → progress store automatically. |
| `components/features/payroll/PayrollRunProgressBanner.tsx` | Amber recovery banner shown on page load when a resumable run exists. |
| `__tests__/payroll-run-progress.test.tsx` | Store unit tests, hook sync tests, banner render/action tests. |

### How it works

`usePayrollRunProgress` is mounted inside (or alongside) the `PayrollWizard`
component. It watches `currentStep`, `employeeIds`, `proofStatus`, and
`submissionStatus` from the wizard store and writes a safe snapshot to
`localStorage` under the key `zk-payroll-run-progress` via the Zustand
`persist` middleware.

On the next page load, `PayrollRunProgressBanner` reads the store. If
`hasResumableRun()` returns `true` (snapshot exists and `submitted === false`)
the banner renders. The user can either resume (navigate to the wizard) or
discard (calls `clearProgress()`).

### What is intentionally excluded from the snapshot

The snapshot **never** stores:

- Employee IDs, names, or salary amounts
- ZK proof data or proof hashes
- Wallet addresses or transaction hashes
- Any field from `PayrollWizardState` that carries a financial value

The snapshot stores only: `runId`, `currentStep`, `employeeCount` (integer),
`proofReady` (boolean), `submitted` (boolean), and `updatedAt` (ISO timestamp).

### Usage

```tsx
// Inside PayrollWizard (or a parent layout):
import { usePayrollRunProgress } from "@/hooks/usePayrollRunProgress";
usePayrollRunProgress({ runId });

// On the dashboard or payroll page header:
import { PayrollRunProgressBanner } from "@/components/features/payroll/PayrollRunProgressBanner";
<PayrollRunProgressBanner onResume={() => router.push("/payroll")} />
```

The banner includes a hydration guard (`useState(false)` + `useEffect`) so
it never renders during SSR, preventing a server/client mismatch.

---

## #471 — Configurable Dashboard Session Timeout Warning

**Goal:** Warn users before expiry and safely preserve non-sensitive draft
state where appropriate.

### Files

| File | Purpose |
| --- | --- |
| `hooks/useSessionTimeoutWarning.ts` | Derives a `TimeoutWarningLevel` from `useSession` state; handles extend and dismiss. |
| `components/features/session/SessionTimeoutWarning.tsx` | Renders banner (warning) or blocking modal (urgent / expired). |
| `__tests__/session-timeout-warning.test.tsx` | Hook and component tests including escalation, onExpired, and sensitive-data checks. |

### Warning levels

| Level | Condition | UI |
| --- | --- | --- |
| `idle` | `timeRemaining > warningThresholdMs` | Nothing rendered |
| `warning` | `≤ warningThresholdMs` and `> urgentThresholdMs` | Dismissible sticky banner |
| `urgent` | `≤ urgentThresholdMs` | Blocking modal — cannot be dismissed, only extended |
| `expired` | `sessionState === "expired"` | Blocking modal — "Sign in again" link only |

The warning automatically **re-surfaces** when the level escalates (e.g. a
dismissed `warning` banner reappears when the level reaches `urgent`).

### Configuration

```tsx
<SessionTimeoutWarning
  warningThresholdMs={10 * 60 * 1000}  // default: 10 min
  urgentThresholdMs={2 * 60 * 1000}    // default: 2 min
  onExtend={async () => {
    await fetch("/api/auth/extend", { method: "POST" });
  }}
  onExpired={() => router.push("/login")}
/>
```

`onExtend` is optional. When omitted the hook calls `useSession().refresh()`
which re-fetches `/api/auth/session`.

### Sensitive data policy

The component never displays session token values, wallet public keys, or any
payroll figures. It only renders the countdown string from
`formatTimeRemaining()` (e.g. `"8m remaining"`).

Mount `<SessionTimeoutWarning />` once in the root dashboard layout so all
protected pages get the warning without per-page wiring.

---

## #469 — Accessible Toast Announcements for Payroll Results

**Goal:** Make success and failure feedback available to assistive
technologies (screen readers) without requiring operators to monitor visual
toast notifications.

### Files

| File | Purpose |
| --- | --- |
| `stores/announcements.ts` | Zustand store with `politeMessage` and `assertiveMessage` slots. |
| `components/ui/LiveRegion.tsx` | Two visually-hidden `aria-live` divs; mount once near the root. |
| `hooks/usePayrollResultAnnouncer.ts` | Combined hook: fires both a `sonner` toast and an ARIA announcement. |
| `__tests__/accessible-toast-announcements.test.tsx` | Store, LiveRegion, and hook tests. |

### Architecture

```text
usePayrollResultAnnouncer
  ├── toast.success/error/warning()   → visual sonner toast
  └── useAnnouncementStore.announce() → politeMessage / assertiveMessage
                                             ↓
                                       <LiveRegion />
                                       (sr-only aria-live divs)
                                             ↓
                               Screen reader reads announcement aloud
```

### Politeness rules

| Method | sonner call | ARIA politeness |
| --- | --- | --- |
| `announceSuccess` | `toast.success` | `polite` |
| `announceInfo` | `toast` | `polite` |
| `announceWarning` | `toast.warning` | `polite` |
| `announceError` | `toast.error` | **`assertive`** |

Errors use `assertive` so screen readers interrupt current speech immediately —
consistent with WCAG guidance that errors require prompt notification.

### Setup (one-time)

Add `<LiveRegion />` once in the root layout:

```tsx
// app/layout.tsx
import { LiveRegion } from "@/components/ui/LiveRegion";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <LiveRegion />   {/* ← adds two sr-only aria-live regions */}
      </body>
    </html>
  );
}
```

### Usage in components

```tsx
import { usePayrollResultAnnouncer } from "@/hooks/usePayrollResultAnnouncer";

const { announceSuccess, announceError } = usePayrollResultAnnouncer();

// Replace direct toast.success() calls:
announceSuccess("Proof generated successfully");

// Replace direct toast.error() calls:
announceError("Submission failed", "Network timeout. Please retry.");
```

### Message content policy

Messages passed to the announcer must **not** contain salary amounts, employee
names, wallet addresses, or proof hashes. Use generic operational language:
"Proof generated", "Submission failed", "Batch of 5 employees queued".

---

## #468 — Reusable Form Unsaved-Changes Guard

**Goal:** Prevent accidental loss of employee and payroll configuration edits
when an operator navigates away or dismisses a form.

### Files

| File | Purpose |
| --- | --- |
| `hooks/useUnsavedChangesGuard.ts` | Headless guard: manages dialog state, `beforeunload` listener, and action callbacks. |
| `components/ui/UnsavedChangesDialog.tsx` | Confirmation modal paired with the guard. |
| `__tests__/unsaved-changes-guard.test.tsx` | Hook and component integration tests. |

### How it works

```text
                     isDirty=false          isDirty=true
                          │                      │
guard.requestNavigation() │                      │
guard.requestDismiss()    │                      │
                          ▼                      ▼
                    proceed()         open UnsavedChangesDialog
                    immediately             │           │
                                      confirmLeave   cancelLeave
                                           │               │
                                      proceed()       do nothing
                                      (navigate/close)
```

`requestNavigation` and `requestDismiss` both accept a `proceed` callback.
The guard tracks `pendingActionType` (`"navigation"` | `"dismiss"`) so the
dialog can display context-appropriate copy:

- Navigation: "Leave page?" / "Leave anyway" / "Stay and keep editing"
- Dismiss: "Discard changes?" / "Discard changes" / "Keep editing"

### Usage

```tsx
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/ui/UnsavedChangesDialog";

function EmployeeEditForm({ onClose }) {
  const [isDirty, setIsDirty] = useState(false);
  const guard = useUnsavedChangesGuard({ isDirty });

  return (
    <>
      <form onChange={() => setIsDirty(true)}>
        {/* ... fields ... */}
      </form>

      <button onClick={() => guard.requestDismiss(onClose)}>
        Close
      </button>

      <UnsavedChangesDialog guard={guard} />
    </>
  );
}
```

Custom copy can be passed to `UnsavedChangesDialog`:

```tsx
<UnsavedChangesDialog
  guard={guard}
  title="Unsaved employee edits"
  description="Your employee configuration changes will be lost."
  confirmLabel="Discard employee edits"
  cancelLabel="Continue editing"
/>
```

### Integration with `usePayrollPolicyStore`

`PayrollPolicyEditor` already computes `isDirty` via `JSON.stringify`
comparison. To add the guard:

```tsx
const guard = useUnsavedChangesGuard({ isDirty });
// then wrap the back-navigation button:
<button onClick={() => guard.requestNavigation(() => router.back())}>Back</button>
<UnsavedChangesDialog guard={guard} />
```

### Accessibility

- The dialog is a `role="dialog"` with `aria-modal="true"`, `aria-labelledby`,
  and `aria-describedby`.
- The **safe** action button (Keep editing / Stay) receives focus on open so
  pressing Enter does not accidentally discard changes.
- The background scroll is not locked in this implementation; add
  `overflow: hidden` to `<body>` via a `useEffect` if needed for your layout.

---

## #460 — Stale Data Refresh Indicator

**Goal:** Notify operators when displayed payroll calculations or operational
snapshots may be out of date and offer a fast, non-blocking refresh action.

### Files

| File | Purpose |
| --- | --- |
| `hooks/useStaleDataRefresh.ts` | Tracks data age, stale threshold, polling intervals, and refresh execution state. |
| `components/features/payroll/StaleDataIndicator.tsx` | Accessible indicator (banner or inline badge) with refresh trigger. |
| `components/features/payroll/PayrollHistory.tsx` | Integrated into historical payroll run tables and summaries. |
| `__tests__/stale-data-refresh-indicator.test.tsx` | Test suite covering stale calculations, refresh callbacks, and error handling. |

### How it works

`useStaleDataRefresh` accepts a `lastFetchedAt` timestamp (or `dataVersion`),
a configurable `staleThresholdMs` (default: 60 seconds), and an `onRefresh`
callback. A timer computes the elapsed duration and updates `isStale`.
When stale, `StaleDataIndicator` displays a warning with an accessible
refresh button (`aria-label="Refresh payroll data"`), spinning refresh icon,
and live feedback for assistive technologies (`role="status"`).

### Design constraints & privacy

- Does not expose raw balances, salaries, or employee tokens in the stale notice.
- Disables the refresh button while a fetch is in-flight to prevent duplicate requests.
- Offers both compact inline and full-width banner presentation variants.

---

## #463 — Responsive Employee Table Controls

**Goal:** Provide full sorting, search filtering, and responsive mobile-optimized
controls for employee directories without horizontal scrolling or tiny touch targets.

### Files

| File | Purpose |
| --- | --- |
| `components/features/employees/EmployeeDirectory.tsx` | Main responsive employee directory component with search, sort, and dual layout. |
| `__tests__/responsive-employee-table-controls.test.tsx` | Automated unit/integration tests for search, sorting, and responsive toggle controls. |
| `__tests__/smoke/mobile-layout.test.tsx` | Mobile viewport smoke tests verifying touch targets (min 44px) and card layouts. |

### Responsive behavior

- **Desktop (md+):** Formatted table layout with interactive column headers
  equipped with `aria-sort="ascending|descending|none"`. Clicking column headers
  cycles sort direction (asc → desc → asc).
- **Mobile (<md):** Card-based employee list rendering key attributes (name,
  department, masked salary/currency, status badge) with dedicated sorting
  select controls and minimum 44px touch targets.
- **Search:** Real-time filtering by employee name, department, or employee ID
  with accessible search input and clear filter options.

---

## #462 — Conflict-Aware Payroll Edit Warning

**Goal:** Prevent accidental data overwrites when multiple operators or automated
jobs modify payroll drafts or reconciliation periods concurrently.

### Files

| File | Purpose |
| --- | --- |
| `hooks/usePayrollConflictWarning.ts` | Conflict detection logic (`detectPeriodConflict`) comparing base and remote snapshots. |
| `components/features/payroll/PayrollConflictBanner.tsx` | Sticky non-blocking alert banner rendered when concurrent edits are detected. |
| `components/features/payroll/PayrollConflictWarningModal.tsx` | Detailed conflict resolution modal with reload and explicit overwrite protection. |
| `__tests__/payroll-conflict-warning.test.tsx` | Unit and integration tests for conflict detection, reload, and overwrite flow. |

### Conflict resolution flow

1. **Detection:** When `baseSnapshot` (version/timestamp loaded by user) diverges
   from `remoteSnapshot` (version, status, or timestamp on server), a conflict is raised.
2. **Notification:** `PayrollConflictBanner` renders at the top of the view with
   the nature of the remote change (e.g., status changed or edited elsewhere).
3. **Resolution choices:**
   - **Reload latest (Safe action):** Fetches remote data and discards local draft conflict.
   - **Review changes:** Opens `PayrollConflictWarningModal` displaying side-by-side
     metadata differences (version, status, timestamp, author).
   - **Explicit overwrite:** Overwriting is protected by an explicit acknowledgement
     checkbox. The overwrite button remains disabled until checked.

---

## #455 — Confirmation Dialog for Payroll Period Finalization

**Goal:** Guard irreversible period finalization with an explicit confirmation
step warning operators of immutability and downstream impacts.

### Files

| File | Purpose |
| --- | --- |
| `components/features/payroll/PeriodFinalizationDialog.tsx` | High-impact modal dialog detailing downstream impacts and requiring confirmation. |
| `components/features/reconciliation/PeriodCloseDashboard.tsx` | Integrated with "Close period" action to replace direct state mutation with dialog. |
| `__tests__/period-finalization-dialog.test.tsx` | Unit tests for dialog rendering, acknowledgement checkbox, and error handling. |
| `__tests__/components/PeriodCloseDashboard.test.tsx` | Integration test verifying confirmation closes period and cancellation preserves state. |

### Downstream impacts explained to operators

- **Permanent Record Locking:** Payroll batches and employee lines cannot be edited.
- **Funding Settlement:** Temporary reservations are permanently settled against vaults.
- **Audit Compliance Seal:** ZK batch roots and audit timelines are immutably archived.
- **Corrections:** Adjustments must be issued through off-cycle supplementary runs.

### Safety defaults

- Safe default focus is placed on the **"Cancel and keep open"** button to prevent
  accidental submission via keyboard Enter.
- The confirm action is disabled until the operator checks the acknowledgement box.
- Escape key or backdrop click safely dismisses the dialog without changing period status.

---

## #464 — Empty States for Payroll Search and Filters

When search or filters hide every run, payroll lists render
`PayrollFilterEmptyState` (`components/filters/PayrollFilterEmptyState.tsx`)
instead of a generic "no data" message.

- **Why it's empty:** `describePayrollEmptyState` (`src/payroll/emptyState.ts`)
  tells apart *no data yet*, *search miss*, *filter miss*, and
  *search + filters*. Each case gets its own title and a "0 of N" explanation.
- **How to recover:** each active constraint appears as a chip with its own
  remove button. A single **Clear all filters** button resets search and every
  filter.
- **Privacy:** only filter labels appear. The search echo is cut to 32
  characters, the employee filter shows as "Employee filter" without the name,
  and run records (amounts, wallets, hashes) are never passed to the
  component.
- **Integrated in:** `PayrollHistory`, `TransactionHistory` (history and
  archived modes).

## Mobile Layout for Payroll Preflight Blockers (#527)

Preflight blocker cards (`PayrollRiskWarnings`, `CompanyStateWarnings`, `OverduePayrollAlertBanner`) use flexible responsive layout containers (`flex-col sm:flex-row`, `p-4 sm:p-5`) to maintain full readability on narrow mobile screens. Touch targets (action buttons, dismiss controls) adhere to the minimum 44px height specification.

## Audit-Friendly Amendment Export (#528)

The amendment export utility (`exportAmendmentMetadata`) and preview modal (`AuditAmendmentExportModal`) enable exporting commitment amendment history in JSON or CSV formats. Only safe metadata fields (`id`, `commitmentVersion`, `previousVersion`, `employeeReference`, `period`, `asset`, `approvalStatus`, `previousCommitment`, `nextCommitment`, `createdAt`) are exported. Raw salary values and private keys are strictly excluded.

## Privacy-Safe Operational Notes on Payroll Runs (#530)

**Goal:** Let an admin hand off context on a payroll run ("second attempt
after a reference collision") without a note ever becoming a place where a
salary figure, an employee's personal data, or a credential is stored.

### Files

| File | Purpose |
| --- | --- |
| `lib/privacy/runNotes.ts` | Sensitive-content scanner and audit-metadata builder. Single source of truth for what a note may contain. |
| `src/payroll/runNotes.ts` | Payroll-facing rules: length budget, validation, role gate, run lock states. |
| `stores/payrollRunNotes.ts` | Session-scoped note store. Re-runs the same rules on write so the guard cannot be bypassed. |
| `components/features/payroll/PayrollRunNotesPanel.tsx` | The panel rendered on `/payroll/[id]`. |
| `__tests__/payroll-run-notes-rule.test.ts` | Scanner, validation, and role/lock rule unit tests. |
| `__tests__/payroll-run-notes-panel.test.tsx` | Store write-path and panel render/interaction tests. |

### Roles

| Role | Behaviour |
| --- | --- |
| `admin` | Full editor: add, list, and remove notes. |
| `operator` | Read-only. The panel states that notes are admin-only instead of hiding a disabled control. |
| `auditor` | Read-only, same restriction copy. |

`PayrollRunDetail` takes a `userRole` prop (default `operator`). The run page
resolves it from the session cookie via `verifySessionToken` and falls back to
`operator`, so an unauthenticated render can never unlock the admin editor.

### States

`validateRunNote` returns an explicit state that the panel renders:

| State | Trigger | UI |
| --- | --- | --- |
| `empty` | Nothing entered (or whitespace only) | Save disabled |
| `valid` | Clean note within the 280-character budget | Live character counter, save enabled |
| `too_long` | Over 280 characters | Red alert stating the exact overflow; save disabled |
| `blocked` | Privacy scanner matched a category | Red alert naming each category plus rewrite guidance; save disabled |
| `read_only` | Non-admin role | Amber restriction banner, no editor |
| `locked` | Run is `cancelled` or `failed` | Lock notice pointing at a replacement batch, no editor |

A successful save shows a `role="status"` confirmation; a rejected write leaves
the text in the editor so the admin can fix it rather than retype it.

### What is blocked

| Category | Examples |
| --- | --- |
| `compensation` | `$5,250`, `1200 USDC`, `48200`, `salary was 90000` |
| `employee_identity` | A roster name, an email address, a `G…` wallet address, `emp_004` |
| `credential` | `seed phrase`, `private key`, `0x` + 40 or more hex characters |

Not blocked, so ordinary operations stay writable: dates (`2026-09-25`), years
(`2026`), batch references (`20260925`), small counts, and compensation
*vocabulary* without a figure ("compensation review", "Q1 bonus run").

### Privacy guarantees

- **No echo.** A finding is a static label and static guidance. A rejected note
  is never quoted back into a message, so nothing from the note body can reach
  a log, export, telemetry event, or rendered error.
- **Two gates.** The store re-validates on write, so calling
  `usePayrollRunNotesStore.getState().addNote(...)` directly cannot bypass the
  role check, the lock check, or the scanner.
- **Session-only.** Notes are held in memory; nothing is persisted to
  `localStorage` and no note is sent to a payroll API.
- **Audit metadata only.** `buildRunNoteAuditEntry` emits run id, note id,
  author role, character count, and timestamp — never the body. Use that shape
  if notes are ever added to an audit trail or export.

### Usage

```tsx
<PayrollRunNotesPanel
  run={run}
  userRole={session.role}
  employees={employeesInRun} // lets the scanner catch a name from this run
/>
```

## Payroll Owner Transfer Review (#546)

The payroll owner is the company admin wallet: it controls the treasury and signs payroll runs. `/settings/roles` now includes a **Transfer payroll ownership** review screen below the role directory.

### Files

- `src/payroll/ownerTransfer.ts`: pure validation (`reviewOwnerTransfer`), `maskWalletAddress`, `isValidStellarAccount`, and `buildOwnerTransferAuditEntry`
- `components/features/settings/OwnerTransferReview.tsx`: the review screen (props-driven)
- `components/features/settings/OwnerTransferReviewContainer.tsx`: supplies the current owner (company admin), role-directory candidates, and the in-flight run count

### Flow

1. Choose the new owner from the role directory (the current owner is excluded), or enter a wallet address.
2. Review the current owner → new owner summary (masked addresses) and the consequences.
3. Type `TRANSFER OWNERSHIP` and tick the acknowledgement.
4. Submit. The request is recorded; the new owner must accept it from their wallet before it takes effect.

### Blocking rules

| Code | When |
| --- | --- |
| `no_candidate` | No new owner is chosen |
| `invalid_address` | Not a valid Stellar account (`StrKey` checksum is verified) |
| `same_as_current_owner` | The address already owns the payroll |
| `runs_in_flight` | Any payroll run is still `pending`: the owner signs in-flight runs |
| `confirmation_mismatch` | The phrase isn't typed exactly |
| `not_acknowledged` | The loss-of-access checkbox isn't ticked |

These are warnings, not blockers: the new owner has a read-only role (auditor or compliance reviewer), or the address is outside the role directory.

### Privacy guarantees

- Addresses are always shown masked (`GABCDE…WXYZ`). No payroll amounts appear on the screen, in messages, or in the audit entry.
- `buildOwnerTransferAuditEntry` records only the action, both masked addresses, and a timestamp.
- There is no backend endpoint yet: `onSubmit` receives the audit-safe entry for a future API or on-chain call.

## #536 — Delegated Approver Management Panel

**Goal:** Enable managing authorized delegated signers and surrogate approvers within the payroll approval workflow while strictly enforcing address validation, duplicate prevention, and zero exposure of sensitive financial values.

### Files

| File | Purpose |
| --- | --- |
| `stores/delegatedApprovers.ts` | Zustand store with `persist` middleware (`zk_delegated_approvers_store`). Holds delegated approvers list and CRUD actions. |
| `lib/validation/delegatedApprover.ts` | Validation logic enforcing non-empty, valid format (Stellar `G...` or delegate identifier), and duplicate checking. |
| `components/features/approvals/DelegatedApproverPanel.tsx` | React UI panel component for viewing, adding, and removing delegated approvers. |
| `__tests__/components/DelegatedApproverPanel.test.tsx` | Unit and integration test suite covering rendering, add/remove actions, validation errors, and privacy guarantees. |

### Validation Rules & Privacy Guarantees

- **Empty Input:** Rejects empty or whitespace-only inputs (`"Approver address or identifier is required."`).
- **Format Validation:** Validates against Stellar address format (`^G[A-Z0-9]{55}$`) or standard delegate identifier pattern (`^[a-zA-Z0-9_-]{3,64}$`).
- **Duplicate Prevention:** Checks case-insensitive matches against existing approver list (`"Duplicate approver address or identifier already exists."`).
- **Privacy Enforcement:** All error messages and UI controls omit sensitive payroll data (salaries, employee names, payment amounts).

## #596 — Dashboard Payout Destination Change Review

**Goal:** Provide an interactive review surface for employee payout destination updates before payroll execution, preventing unauthorized, invalid, or conflicting destination changes without exposing sensitive employee PII or financial amounts.

### Files

## #520 — Pagination Safety Controls

**Goal:** Prevent accidental over-fetching and show clear pagination boundaries in large payroll lists without exposing sensitive salary values or employee PII.

### Files

| File | Purpose |
| --- | --- |
| `src/payroll/paginationSafety.ts` | Pure validation and calculation rules (`calculatePaginationSafety`, `MAX_PAGE_SIZE = 100`). |
| `components/payroll/PaginationSafetyControls.tsx` | Pagination UI component rendering safe range boundaries and over-fetch warning banners. |
| `__tests__/payroll-pagination-safety.test.tsx` | Unit and component test suite covering standard pagination, over-fetch clamping, and out-of-bounds page handling. |

## #518 — Dashboard Support for Payroll Run Amendments

**Goal:** Allow authorized users to review amendment details alongside original payroll run metadata without overwriting or mutating the original payroll record.

### Files

| File | Purpose |
| --- | --- |
| `src/payroll/amendments.ts` | Domain helpers (`createPayrollRunAmendmentReview`, `assertOriginalRecordIntact`). |
| `components/payroll/PayrollRunAmendmentReview.tsx` | Dashboard review component rendering immutable original record banner, proposed amendment details, safe diff, and action buttons. |
| `__tests__/payroll-run-amendment-review.test.tsx` | Unit and component tests verifying record immutability, safe diff rendering, and stale/policy warning handling. |

## #517 — Treasury Snapshot Activity Cards

**Goal:** Display privacy-safe treasury health metrics and snapshot activity events on payroll operation views.

### Files

| File | Purpose |
| --- | --- |
| `src/treasury/snapshotActivity.ts` | Domain calculation rules (`calculateTreasurySnapshotHealth`, `formatMerkleRootShort`). |
| `components/treasury/TreasurySnapshotActivityCard.tsx` | UI card displaying coverage ratios, status badges, Merkle root digests, and snapshot activity event logs. |
| `__tests__/treasury-snapshot-activity-card.test.tsx` | Unit and component tests covering healthy metrics, funding deficit warnings, and event verification errors. |

## #519 — Cancellable Data Refresh Actions

**Goal:** Allow users to stop long-running refreshes while maintaining consistent loading states and zero financial data leaks.

### Files

| File | Purpose |
| --- | --- |
| `hooks/useCancellableDataRefresh.ts` | React hook managing `AbortController` signal, cancellation state, and privacy-safe status messages. |
| `components/payroll/CancellableRefreshButton.tsx` | UI button displaying active refreshing indicator with a Cancel button. |
| `__tests__/cancellable-data-refresh.test.tsx` | Unit and component tests for successful refresh, mid-flight cancellation, and error handling. |

## Test coverage summary

| #510 | `payroll-preflight-results-screen.test.tsx` | Renders readiness score, blocker cards, warnings, passed checks, and dry-run summary | Disables execution button when blockers exist; enables fix actions and re-run dry run |
| #509 | `payroll-amendment-history-panel.test.tsx` | Displays authorized amendment revision history, safe reason labels, and details drawer | Filters by status & search query; exports safe JSON/CSV metadata |
| #514 | `payroll-cancellation-reason-selector.test.tsx` | Enforces selecting documented cancellation reason before confirming cancellation | Provides helper text and custom audit notes input; disables confirmation until reason selected |
| #515 | `audit-grant-scope-details-drawer.test.tsx` | Displays auditor identity, expiry indicator, accessible scopes, restricted scopes, and masking tier | Triggers extend, revoke, and export scope callbacks |
| #536 | `DelegatedApproverPanel.test.tsx` | Renders panel, adds valid approver, rejects duplicates/invalid inputs with clear error, removes approver, and enforces zero sensitive payroll data exposure |
| #596 | `payout-destination-change-review.test.tsx` | Validates approval criteria, blocks invalid addresses / identical addresses / active cooldowns, validates rejection reasons, displays masked addresses, renders dashboard mode |
| #520 | `payroll-pagination-safety.test.tsx` | Calculates safe pagination boundaries, clamps page size to MAX_PAGE_SIZE (100), handles empty lists & out-of-bounds pages, renders UI controls |
| #518 | `payroll-run-amendment-review.test.tsx` | Reviews proposed amendments non-destructively, preserves original payroll record intact, renders safe diff & stale/policy warning alerts |
| #517 | `treasury-snapshot-activity-card.test.tsx` | Calculates coverage ratio & status badges, renders truncated Merkle digests & snapshot activity logs, triggers actionable deficit warnings |
| #519 | `cancellable-data-refresh.test.tsx` | Manages AbortController signal, cancels in-flight refreshes, maintains consistent loading states, displays actionable privacy-safe feedback |

Run with:

```bash
npm test
```

