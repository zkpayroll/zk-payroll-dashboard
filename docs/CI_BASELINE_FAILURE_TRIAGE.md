# CI Baseline Failure Triage and Fix Plan

`Dashboard CI` is red on `dev`. Every run in the upstream repository fails —
not only for new branches, but for `dev` itself and for unrelated pull
requests. This document records what is broken, why, and how to fix it in a
sequence that keeps the tree green at every step.

> Measured on `zkpayroll/zk-payroll-dashboard@dev` (`47c968b`), Node 22,
> `npm ci`, 2026-10-21. Every figure below was reproduced from the commands
> in §6.

---

## 1. Current state

| Gate | Command | Result on `dev` |
| --- | --- | --- |
| Lint | `npm run lint` | ✅ passes (2 pre-existing warnings in `PayrollWizard.tsx`) |
| Typecheck | `npm run typecheck` | ❌ **157 errors** (67 in source, 90 in tests) |
| Test | `npm test` | ❌ **25 files / 38 tests** failing (3009 passing) |
| Smoke | `npm run test:smoke` | ✅ passes (67/67) |

The 25 failing test files split cleanly into two groups:

- **7 files fail to even load** — a module cannot be resolved, so the whole
  file errors out before a single test runs.
- **18 files load and run, with 38 individual test failures** between them.

Evidence that this is pre-existing and not caused by any single change:

- All 30 most recent `Dashboard CI` runs in the upstream repository are
  `failure` — including runs for `dev` directly and for unrelated feature
  branches (`feat/issue-729-…`, `feat/issue-738-…`, `feat/issue-740-…`).
- Re-running exactly the 25 failing test files on a tree with the changes
  stashed produces the identical failure set (one additional flake,
  `payroll-run-progress`, passes intermittently).

### Why it matters

1. **No PR can be trusted.** A green run is currently impossible, so reviewers
   cannot distinguish a real regression from background noise. This is the
   single biggest review-throughput problem in the repository.
2. **The `Auto Merge Clean Pull Requests` workflow merges on conflict
   cleanliness alone.** It does not check CI, so red CI provides no protection
   whatsoever at the merge boundary — PRs are landing in a red tree today.
3. **The `close-dev-linked-issues.yml` workflow closes issues on merge.** Issues
   are being closed against a gate that never passes, so the issue tracker
   drifts away from the actual state of the tree.

---

## 2. Root causes

The failures are not random. They fall into six causes, and five of the six are
mechanical.

| Cause | Type errors | Test files unblockable | Test failures fixed |
| --- | --- | --- | --- |
| **A** — `tsconfig.json` targets ES5 | 43 | — | — |
| **B** — Import path alias drift | 5 | 5 | — |
| **C** — Phantom references to modules that were never written | 12 | 2 | — |
| **D** — Typos and wrong exported names | 19 | — | — |
| **E** — Type drift between source and tests | 78 | — | — |
| **F** — Test expectation drift | — | — | 32 |
| **G** — Test-harness and environment issues | — | — | 6 |
| **Total** | **157** | **7** | **38** |

### Cause A — `tsconfig.json` targets ES5 (43 type errors)

`tsconfig.json` sets `"target": "es5"`, but the codebase uses BigInt literals
and iterates `Map`/`Set` directly.

- `error TS2737: BigInt literals are not available when targeting lower than
  ES2020` — **40 errors**, all in `lib/treasury/balanceBuffer.ts` (5) and
  `__tests__/treasury-balance-buffer-enforcement.test.ts` (35).
- `error TS2802: Type 'MapIterator<…>' can only be iterated through when using
  the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher` —
  **3 errors** in `lib/assets/paymentAssetCompatibility.ts`,
  `lib/compensation/compensationGroupMembership.ts`,
  `lib/payroll/exceptionOwnership.ts`.

This is a **single-line fix** that removes 43 of the 157 errors and unblocks
BigInt-based money maths, which is the correct representation for token
amounts.

### Cause B — Import path alias drift (5 errors, 5 root causes)

The `@/*` path alias maps to the repository root, but several modules live
under `src/`. Imports were written against a root-level `payroll/` directory
that does not exist, and one import is missing its leading slash.

| Broken import | Correct import | File |
| --- | --- | --- |
| `@/payroll/compensationPolicyDependencyMapping` | `@/src/payroll/compensationPolicyDependencyMapping` | `__tests__/compensation-policy-dependency.test.ts` |
| `@/payroll/outlierPaymentInvestigationWorkflow` | `@/src/payroll/outlierPaymentInvestigationWorkflow` | `__tests__/outlier-payment-investigation.test.ts` |
| `@/payroll/recipientValidationReconciliation` | `@/src/payroll/recipientValidationReconciliation` | `__tests__/recipient-validation-reconciliation.test.ts` |
| `@/payroll/reviewerDecisionConflictDetection` | `@/src/payroll/reviewerDecisionConflictDetection` | `__tests__/reviewer-decision-conflict.test.ts` |
| `@hooks/useContractPauseGuard` | `@/hooks/useContractPauseGuard` | `app/payroll/create/page.tsx` |

All five target files exist and are already exported from `src/payroll/index.ts`.
Only the import specifiers are wrong. Fixing them unblocks **5 of the 7**
test files that currently cannot load.

### Cause C — Phantom references to modules that were never written (12 errors)

These are references to files that **have never existed in the repository
history** (`git log --all --diff-filter=A` confirms it). A referencing PR was
merged while its dependency was still outstanding, so the tree has been
permanently unbuildable for these paths.

| Missing module | Errors | Referenced from | Consequence |
| --- | --- | --- | --- |
| `./ledger-export-consistency` | 3 | `lib/dashboard/ledgerExportConsistency.ts` | library cannot compile |
| `@/lib/payroll/retryPolicyDecisionLog` | 2 | `app/payroll/create/page.tsx`, `app/payroll/recovery/page.tsx` | 2 pages cannot compile |
| `@/components/features/exports/LedgerExportConsistencyValidator` | 1 | `app/exports/page.tsx` | 1 page cannot compile |
| `@/components/features/payroll/PayrollAdjustmentApprovalExpiryPanel` | 1 | `app/payroll/approvals/page.tsx` | 1 page cannot compile |
| `@/components/triage/ExceptionOwnershipTracker` | 1 | `app/payroll/exceptions/page.tsx` | 1 page cannot compile |
| `@/components/payroll/ExceptionOwnershipTracker` | 1 | `__tests__/payroll-exception-ownership.test.tsx` | 1 test file cannot load |
| `../src/dashboard/ledger-export-consistency` | 1 | `__tests__/dashboard-ledger-export-consistency.test.ts` | 1 test file cannot load |
| `@vest/runner` | 1 | `__tests__/dashboard-ledger-export-consistency.test.ts` | external package is not in `package.json` |

**Decision required per row:** either implement the missing module, or remove
the reference. Six of the eight are referenced by *application* code, so
"remove the reference" means deleting the feature wiring; "implement" means
landing the feature that was promised by the merged PR. This is a product
decision, not a mechanical one — see §5.

`@vest/runner` is different: it is a real external package. Either add it to
`package.json` (and accept the dependency) or rewrite the test to use the
built-in `node:test` runner that the repo already uses elsewhere.

### Cause D — Typos and wrong exported names (19 errors)

| Error | Errors | Location | Fix |
| --- | --- | --- | --- |
| `Cannot find module 'lucides-react'` | 1 | `components/amendments/AmendmentApproval.tsx:14` | `lucide-react` |
| `Cannot find module 'next/distorection'` | 1 | `app/payroll/amendments/[id]/approval/page.tsx:1` | `next/navigation` (the only page importing `NotFound` this way) |
| `Cannot find name 'ExceptionStatus'` | 1 | `lib/payroll/exceptionOwnership.ts:12` | the file declares `export type ExceptionSttatus` (typo) at line 5; delete it and import `ExceptionStatus` from `@/types/models` |
| `'"lucide-react"' has no exported member named 'RotateCc'` | 1 | `components/dashboard/FallbackFundingSourceSimulation.tsx:4` | `RotateCcw` |
| `has no exported member named 'FailoverSelectionResult'` | 1 | `components/dashboard/FallbackFundingSourceSimulation.tsx:10` | `FailoverValidationResult` |
| `Type '"treasury"' is not assignable to type 'FundingSourceType'` | 1 | `components/dashboard/FallbackFundingSourceSimulation.tsx:33` | add `"treasury"` to the union or use the existing member |
| `Module '"@/lib/api/validation"' has no exported member 'postSubmissionAdjustmentSchema'` | 1 | `app/api/payroll/route.ts:14` | export the schema, or drop the call site |
| `Property 'adjustmentLimits' does not exist on type 'PayrollRun'` | 1 | `app/api/payroll/route.ts:124` | add the field to the model |
| `Property 'retryPolicy' does not exist on type 'PayrollRun'` | 1 | `app/payroll/[id]/page.tsx:35` | add the field to the model |
| `Property 'adjustmentAttempts' / 'submittedAt' does not exist on type 'SalaryCommitmentAmendment'` | 3 | `components/amendments/AmendmentApproval.tsx:51,60` | add the fields to the model |
| `Module '"./AmendmentApproval"' has no exported member 'default'` | 1 | `components/amendments/index.ts:4` | the component has a named export only — fix the re-export |
| `Export declaration conflicts with exported declaration of 'PayoutConfirmationRetryPolicy'` | 4 | `lib/payroll/payoutConfirmationRetryPolicy.ts:197-200` | the file both `export`s and `export type`s the same names |
| `Module "./beneficiaryChangeVerificationWorkflow" has already exported a member named 'maskAddress'` | 1 | `src/payroll/index.ts:32` | disambiguate the barrel re-export |

### Cause E — Type drift between source and tests (78 errors)

The remaining errors are genuine type mismatches, split **32 in source** and
**46 in tests**:

#### Source (32)

| Errors | File | Nature |
| --- | --- | --- |
| 7 | `src/audit/dashboardAuditEventSequenceVerification.ts` | `Cannot find name 'AuditActivityEntry'` — the type was never imported |
| 3 | `app/api/payroll/route.ts` | Zod v4 `safeParse` no longer narrows `parsed.data` to a known type (`TS18046`), plus a comparison between non-overlapping unions (`TS2367`) |
| 3 | `app/payroll/create/page.tsx` | `string \| null` passed to a `string` parameter (`TS2345` ×3) |
| 2 | `app/api/payroll/[id]/route.ts` | `No overload matches this call` (`TS2769` ×2) |
| 2 | `app/payroll/period-close/page.tsx` | props not declared on the component, implicit `any` callback |
| 2 | `components/dashboard/FallbackFundingSourceSimulation.tsx` | implicit `any` callback parameters (`TS7006` ×2) |
| 2 | `lib/compensation/compensationGroupMembership.ts` | implicit `any` map parameters (`TS7006` ×2) |
| 2 | `lib/errors/privacySafeErrorContext.ts` | `ErrorAudience` union extended with `admin` but the `Record` was not, plus an unresolvable index type |
| 1 each | `app/payroll/execute`, `app/payroll/recovery`, `app/payroll/simulation`, `components/features/payroll/PayrollActivityTimeline`, `components/features/payroll/PayrollApprovalAuditTrail`, `lib/assets/paymentAssetCompatibility`, `setupTests.ts`, `stores/delegatedApprovers` | see §6 for the full list |

Two of these are worth calling out because they are **real bugs, not type
noise**:

- `components/features/payroll/PayrollActivityTimeline.tsx` and
  `PayrollApprovalAuditTrail.tsx` build a `Record<PayrollApprovalActionType, …>`
  that is missing the `period_locked` and `period_reopened` keys — two
  approval actions render with no icon.
- `setupTests.ts:10` assigns to `crypto.subtle`, which TypeScript flags as
  read-only. It works at runtime because the polyfill only runs when
  `subtle` is absent, but the assignment should be a guarded cast.

#### Tests (46)

- **Fixtures missing required fields** — `Employee` gained `salaryCommitment`,
  `isActive`, `onboardingStatus`, `startDate`; test fixtures were never
  updated (`__tests__/payment-instruction-duplicate-detection.test.tsx`,
  6 errors; also `payroll-exception-ownership.test.tsx`).
- **`null` vs `undefined`** — optional fields declared as `number | undefined`
  but fixtures assign `null`
  (`__tests__/components/dashboard-payout-variance-anomaly.test.tsx`, 4 errors).
- **Zustand store mocking** — `vi.spyOn(store, 'mockReturnValue')` no longer
  type-checks against `UseBoundStore<WithPersist<…>>`
  (`__tests__/components/dashboard-organization-config-change-ledger.test.tsx`,
  8 errors).
- **Vitest 4 `vi.fn` generics** — the old `vi.fn<Return, Args>()` signature is
  gone; it is now `vi.fn<(…args) => Return>()`. This affects every test that
  typed a mock explicitly (4 errors in
  `__tests__/import-salary-commitment-duplicate-warning.test.tsx`).
- **TypeScript 5.9 strictness** — `TS5097` and `TS1215` (the `eval` usage in
  `__tests__/outlier-payment-investigation.test.ts`).

### Cause F — Test expectation drift (32 of the 38 failing tests)

Component behaviour changed without the tests being updated.

| Failure | File | Nature |
| --- | --- | --- |
| `expected 'correction_requested' to be 'pending_executive_approval'` | `approval-queue.test.tsx` | status enum renamed |
| `expected 'Please select an active settlement as…' to contain 'Select an active settlement asset'` | `deactivated-asset-banner.test.tsx` | copy changed |
| `expected 'confirm' to be 'submit'` | `payroll-confirmation.test.tsx` | step id renamed |
| `expected '[redacted]' to be '••••'` (×4) | `privacy-safe-error-context.test.ts` | mask token changed from `••••` to `[redacted]` |
| `expected +0 to be 75` | `readiness-scoring.test.ts` | signal weight changed |
| `Found multiple elements with the text: …` (×5) | `payroll-activity-timeline`, `payroll-amendment-history-panel`, `payroll-history`, `signer-quorum-tracker` (×2) | query no longer unique after a UI change |
| `Unable to find … role "link" / "button" / "heading"` (×8) | `missing-proof-warning` (×2), `payroll-run-progress` (×2), `payroll-wizard-stepper` (×2), `payroll-wizard` (×2) | button label or structure changed |
| `expected false to be true` | `payroll-keyboard-shortcuts.test.tsx` | `isInputElement` logic drifted |
| `expected "vi.fn()" to be called with arguments: [ 'amd_valid_001' ]` | `payroll-review-keyboard-nav.test.tsx` | callback contract changed |
| `expected 307 to be 200` | `role-based-access.test.tsx` | middleware now redirects an operator route |
| `expected 'w-full text-left …' not to contain 'opacity-50'` | `role-based-access.test.tsx` | lock styling changed |
| `Unable to find an accessible element with the role "combobox"` | `role-based-access.test.tsx` | role selector markup changed |
| 8 remaining failures | `payroll-wizard.test.tsx` | several share one root cause — triage individually |

### Cause G — Test-harness and environment issues (6 failing tests)

| Failure | File | Fix |
| --- | --- | --- |
| `vi.advanceTimerByTimeAsync is not a function` | `payroll-wizard.test.tsx` | vitest 4 renamed it to `vi.advanceTimersByTimeAsync` (3 call sites) |
| `The vi.spyOn() function could not find an object to spy upon` (×2) | `request-id-support-panel.test.tsx` | jsdom does not implement `navigator.clipboard` — stub it in `setupTests.ts` |
| `Snapshot … mismatched` (×3) | `visual-regression/payroll-flow-states.test.tsx` | **the snapshot embeds the wall clock** — see below |

The visual-regression snapshots record `Last refreshed: Just now (Sep 30, 2026,
09:35 AM)`. The component renders `new Date()` at render time, so the snapshot
mismatches on every run after the one that recorded it. The fix is to freeze
the clock in the test, not to re-record the snapshot:

```ts
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T09:35:00"));
});
afterAll(() => {
  vi.useRealTimers();
});
```

The `Not implemented: navigation (except hash changes)` noise emitted by
jsdom during the `payroll-wizard` run is a second-order symptom of the timer
API mismatch, not a separate defect.

---

## 3. Fix plan

Ordered so that every phase leaves the tree in a strictly better state and can
be merged independently.

| Phase | Scope | Type errors removed | Test files unblocked | Test failures fixed | Risk |
| --- | --- | --- | --- | --- | --- |
| **1** | `tsconfig.json` target → `ES2020` | 43 | — | — | Low — compiler-only, no runtime change |
| **2** | Import alias drift (Cause B) | 5 | 5 | — | Low — path strings only |
| **3** | Typos and wrong export names (Cause D) | 19 | — | — | Low — mechanical renames |
| **4** | Phantom references (Cause C) | 12 | 2 | — | **Medium — product decision** |
| **5** | Test-harness and environment fixes (Cause G) | — | — | 6 | Low — test-only |
| **6** | Type drift in source and fixtures (Cause E) | 78 | — | — | Medium — touches many files |
| **7** | Expectation drift (Cause F) | — | — | 32 | Medium — one assertion per test |

**Phase 1** — one line in `tsconfig.json`:

```diff
-    "target": "es5",
+    "target": "es2020",
```

**Phase 2** — five import specifiers, listed in §2 Cause B.

**Phase 3** — the nineteen corrections in §2 Cause D. Each is a rename or a
model-field addition; the model additions (`adjustmentLimits`, `retryPolicy`,
`adjustmentAttempts`, `submittedAt`) need the domain owner to confirm the
intended shape.

**Phase 4** — for each of the eight phantom references, choose one of:

- **implement** the module (the feature was promised by a merged PR and is
  expected by the referencing UI), or
- **unwire** the reference (the feature was abandoned and the referencing
  markup should be removed), or
- **defer** by replacing the import with a typed placeholder that renders a
  "not available" state — this keeps the page compiling without shipping a
  half-feature.

**Phase 5** — the six harness fixes in §2 Cause G, plus the `navigator.clipboard`
stub in `setupTests.ts`.

**Phase 6** — the bulk of the remaining work. Recommended order:

1. Source-side type errors first (32 → ~0), because several test failures are
   downstream of source type errors.
2. Shared test fixture factories — the `Employee` fixture drift in at least
   three test files should be fixed with one factory helper rather than three
   copies.
3. `setupTests.ts` typing (`TS2540: Cannot assign to 'subtle' because it is a
   read-only property`) needs a guarded cast.
4. The Vitest 4 `vi.fn` generic migration — a mechanical search-and-replace
   across the test suite.

**Phase 7** — expectation drift. For each failing test, decide whether the
**code** or the **test** is correct:

- If the code change was intentional, update the assertion (the majority of
  cases).
- If the code regressed, fix the code. Two cases look like real regressions
  and deserve a second look rather than a test rewrite:
  - `role-based-access.test.tsx` — `expected 307 to be 200` for a payroll
    operator hitting `/payroll/execute` (an operator losing access to an
    execution route is a functional regression, not a test artefact).
  - `readiness-scoring.test.ts` — `expected +0 to be 75` (a readiness signal
    that no longer contributes to the score is a scoring bug).

---

## 4. Definition of done

- [ ] `npm run typecheck` reports **0** errors.
- [ ] `npm test` reports **0** failing files.
- [ ] `npm run lint` and `npm run test:smoke` remain green.
- [ ] `npm run lint:md` reports no new findings.
- [ ] `npm run build` still succeeds after the `tsconfig.json` target bump
      (Phase 1 is the only change that can affect the build output).
- [ ] A `Dashboard CI` run on a throwaway branch is green end to end.
- [ ] The `Auto Merge Clean Pull Requests` workflow is changed to require a
      green `Dashboard CI` check before merging — otherwise the red baseline
      remains a permanent hole in the merge gate.

## 5. Open questions for the maintainers

1. **Cause C needs a product decision.** The eight phantom modules were
   promised by merged PRs. Should they be implemented, unwired, or deferred?
   This is the only phase that is not mechanical.
2. **Should the `Auto Merge Clean Pull Requests` workflow wait for CI?** It
   currently merges on conflict cleanliness alone and has been merging PRs
   into a red tree throughout.
3. **Should `tsconfig.json` target be raised further?** `ES2020` clears the
   BigInt errors; `ES2022` would additionally allow class fields and
   `at()`. Both are supported by Next.js 14.
4. **Is `target: "es5"` deliberate?** It was likely inherited from the
   original scaffold and never revisited as the codebase adopted BigInt.
5. **Is `navigator.clipboard` worth polyfilling globally?** Stubbing it in
   `setupTests.ts` fixes two tests, but a global polyfill would also protect
   future tests that assume a browser-like clipboard.

## 6. Appendix — reproducing the measurements

```bash
npm ci

# typecheck breakdown
npx tsc --noEmit > tsc.txt
grep -c "error TS" tsc.txt                       # 157
grep -oE "error TS[0-9]+" tsc.txt | sort | uniq -c | sort -rn
grep "error TS" tsc.txt | grep -c "^__tests__"   # 90 in tests
grep "error TS" tsc.txt | grep -vc "^__tests__"  # 67 in source

# missing-module inventory
grep "TS2307" tsc.txt | sed -E "s/^([^:]+):.*Cannot find module '([^']+)'.*/\2 <- \1/"

# prove the phantom modules never existed
git log --all --oneline --diff-filter=A --name-only | grep -i "<module>"

# test failures
npx vitest run 2>&1 | tail -40                   # 25 files / 38 tests failing
npx vitest run 2>&1 | grep "FAIL" | grep -v "\[ __tests__"   # 38 individual failures
npx vitest run 2>&1 | grep "FAIL" | grep "\[ __tests__"     # 7 files that cannot load
```
