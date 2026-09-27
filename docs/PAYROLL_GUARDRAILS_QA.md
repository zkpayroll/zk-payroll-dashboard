# Payroll Guardrails — Behaviour & Repeatable QA

Operator-facing reference for the payroll guardrails added in #541–#544. Each
section covers where the feature lives, how it behaves, what it guarantees
about sensitive data, and repeatable manual QA steps (main path, edge case
and failure state) alongside the automated tests that cover it.

> **Privacy rule shared by all four features:** none of them shows, logs or
> echoes salary amounts, wallet addresses or other employee identifiers in
> errors, tooltips, toasts or audit entries.

Run all automated coverage for this page with:

```bash
npx vitest run \
  __tests__/multi-asset-rounding-tooltip.test.tsx \
  __tests__/employee-identifier-format.test.ts \
  __tests__/payout-count-limit-indicator.test.tsx \
  __tests__/audit-hold-release-dialog.test.tsx
```

---

## Multi-asset rounding explanation tooltip (#544)

**Where:** Payroll → Multi-asset → open a run. There is an ⓘ button next to each **"*ASSET* total"** card in `MultiAssetPayrollReview`.

**Behaviour** (`describeAssetRounding` in `lib/payroll/multiAsset.ts`):
- Every Stellar asset settles with **7 decimal places**, so each payment is rounded to 0.0000001 of the asset.
- Totals are displayed with 2–7 decimals.
- A group total can differ from an unrounded or converted figure by at most **payment count × ½ stroop**.
- Each asset is rounded independently. There is no cross-asset conversion.
- The tooltip opens on hover, keyboard focus or click, and closes on mouse-leave, blur, a second click or **Escape**.

**Privacy:** the explanation is computed from the asset code and payment count only, never from individual amounts.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open a multi-asset run and Tab to the ⓘ next to "USDC total" | The tooltip appears. A screen reader announces it through `aria-describedby`. |
| 2 | Read the drift line on a group with several payments | "Across *N* payments … at most *N × 0.00000005* USDC". |
| 3 | Press **Escape** | The tooltip closes. |
| 4 | Edge case: a group with one payment | "With a single payment, rounding affects at most half of one stroop." |
| 5 | Privacy: compare the tooltip text with the employee amounts in that group | No employee amount appears. |

---
