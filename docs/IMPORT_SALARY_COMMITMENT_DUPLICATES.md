# Import Duplicate Salary Commitments (#749)

Employee CSV imports turn every accepted row into a ZK salary commitment before
the row joins the directory. A commitment binds one hidden salary to one wallet
address. When a source file contains the same binding twice, the import would
create two commitments to the same hidden statement — the employee would be paid
twice for the same period, and the directory would hold two records that are
indistinguishable on-chain.

This feature detects those duplicates while the file is still being previewed
and blocks the import until the operator resolves every group.

## What is detected

| Kind | Trigger | Blocking |
| --- | --- | --- |
| `duplicate_salary_commitment` | Two or more rows bind the same salary amount to the same wallet address | Yes |
| `identical_commitment_value` | Two or more rows carry the exact same commitment value | Yes |

Out of scope on purpose:

- The same salary on **different** wallets — two people can legitimately earn
  the same amount, so the commitments are distinct.
- The same wallet with **different** salaries — that is a wallet collision, and
  the import conflict resolver already reports it.

## Behaviour

1. The parsed file is scanned for duplicate commitments as soon as it is
   previewed.
2. Every affected row is highlighted in the preview table and marked with a
   `Duplicate commitment` badge.
3. A panel above the table lists each duplicate group with the masked wallet
   address, the participating row numbers, and the remediation copy.
4. While a group is unresolved:
   - `Import all valid` is disabled.
   - The per-row `Import` action of every affected row is replaced by
     `Resolve duplicate`.
5. The operator resolves a group by keeping a single row, or by excluding
   every row in the group. Excluded rows are marked `Duplicate commitment —
   excluded`, are removed from the import set, and are not handed to the import
   conflict resolver.
6. Once every group is resolved, the import proceeds as usual.

## Public API

Pure domain module `src/payroll/importSalaryCommitmentDuplicates.ts`
(re-exported from `lib/payroll/importSalaryCommitmentDuplicates.ts` and
`src/payroll/index.ts`):

```ts
normalizeImportSalary(value: number | string | null | undefined): number | null
maskCommitmentValue(value: string | null | undefined): string
findDuplicateSalaryCommitments(rows: SalaryCommitmentImportRow[]): SalaryCommitmentDuplicateGroup[]
evaluateDuplicateSalaryCommitments(rows: SalaryCommitmentImportRow[]): SalaryCommitmentDuplicateReport
hasDuplicateSalaryCommitments(rows: SalaryCommitmentImportRow[]): boolean
```

`SalaryCommitmentDuplicateReport` carries `isDuplicate`, `isBlocking`, the
`groups`, the `affectedRowIndexes`, and a one-line `summary`.

UI component `components/features/employees/ImportSalaryCommitmentDuplicateWarning.tsx`
renders the panel. It accepts `groups`, an optional `resolutions` map (group id
to the kept row index, or `"skip"`), and an optional `onResolve` callback.

## Error and remediation semantics

There is no error code: the import is not failed, it is gated. The operator
sees an actionable choice per group (keep one row, or exclude the group), and
the import only becomes available once every group is resolved.

The `actionableRemediation` copy of a group is:

> Keep a single row for this wallet, or exclude every row in the group, before
> importing.

## Privacy guarantees

- Raw salary amounts never appear in a message, a remediation hint, a group
  identifier, or a rendered field. Only the masked wallet address
  (`GDQP2K…4W37`), the truncated commitment value (`0x8fae32bc…9102`), and
  the source row numbers are exposed.
- The group objects themselves only carry privacy-safe rows: the raw salary
  and the full wallet address are dropped before a group leaves the detector.
- The group identifier is derived from the participating row numbers, so no
  salary-derived value can be recovered from the DOM.

## Notes on the commitment semantics

The imported commitment is `sha256(salary | address | salt)` with a fresh salt
per row, so two duplicate rows produce two *different* commitment hashes. They
are nevertheless the same commitment in the ZK sense: the same hidden salary
bound to the same wallet. The detector therefore compares the committed
*amount* and the *wallet*, and separately flags rows that literally carry the
same commitment value.

## Tests

- `__tests__/import-salary-commitment-duplicates.test.ts` — detector unit
  tests: success case, rejected case, boundary cases (same salary on
  different wallets, same wallet with different salaries, a single row, the
  same amount written differently, unparseable amounts, mixed files), and
  privacy assertions.
- `__tests__/import-salary-commitment-duplicate-warning.test.tsx` — panel
  rendering and resolution, plus the end-to-end import preview behaviour:
  clean files import normally, duplicated files are highlighted and blocked,
  and resolving a group re-enables the import.
