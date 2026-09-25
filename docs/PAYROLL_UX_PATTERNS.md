# Payroll UX Patterns

Developer reference for the four UX reliability patterns introduced in issues
#468–#471. Each section covers the motivation, the files involved, usage
examples, and important design constraints.

---

## #470 — Payroll Run Progress Persistence

**Goal:** Restore visible batch progress after a refresh without exposing
sensitive payroll data.

### Files

| File | Purpose |
|---|---|
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
|---|---|
| `hooks/useSessionTimeoutWarning.ts` | Derives a `TimeoutWarningLevel` from `useSession` state; handles extend and dismiss. |
| `components/features/session/SessionTimeoutWarning.tsx` | Renders banner (warning) or blocking modal (urgent / expired). |
| `__tests__/session-timeout-warning.test.tsx` | Hook and component tests including escalation, onExpired, and sensitive-data checks. |

### Warning levels

| Level | Condition | UI |
|---|---|---|
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
|---|---|
| `stores/announcements.ts` | Zustand store with `politeMessage` and `assertiveMessage` slots. |
| `components/ui/LiveRegion.tsx` | Two visually-hidden `aria-live` divs; mount once near the root. |
| `hooks/usePayrollResultAnnouncer.ts` | Combined hook: fires both a `sonner` toast and an ARIA announcement. |
| `__tests__/accessible-toast-announcements.test.tsx` | Store, LiveRegion, and hook tests. |

### Architecture

```
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
|---|---|---|
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
|---|---|
| `hooks/useUnsavedChangesGuard.ts` | Headless guard: manages dialog state, `beforeunload` listener, and action callbacks. |
| `components/ui/UnsavedChangesDialog.tsx` | Confirmation modal paired with the guard. |
| `__tests__/unsaved-changes-guard.test.tsx` | Hook and component integration tests. |

### How it works

```
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

## Test coverage summary

| Issue | Test file | Happy path | Edge case |
|---|---|---|---|
| #470 | `payroll-run-progress.test.tsx` | Banner renders on resumable run; Resume/Discard work | Submitted run → no banner; null runId → no record |
| #471 | `session-timeout-warning.test.tsx` | Banner at warning; modal at urgent; expired modal | Escalation re-surfaces dismissed warning; onExpired fires once |
| #469 | `accessible-toast-announcements.test.tsx` | Success → polite; error → assertive | Repeat message debounce; store auto-clear at 3s |
| #468 | `unsaved-changes-guard.test.tsx` | Clean form proceeds immediately; dirty opens dialog | Two sequential actions; beforeunload registered/removed |

Run with:

```bash
npm test
```
