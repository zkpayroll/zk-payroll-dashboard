# Employer Role Changes

How the dashboard behaves when an employer account's role changes (issue #896): for example, an admin is demoted to operator, or an auditor is promoted to admin.

A live preview of every transition is available at `/company/role-changes`.

## Files

| File | Purpose |
| --- | --- |
| `lib/company/employerRoleChange.ts` | Pure rules: classifies the change and computes gained/lost navigation, gained/lost actions, and whether the current page is still reachable. |
| `components/features/company/EmployerRoleChangeNotice.tsx` | Notice shown to the user whose role changed. |
| `components/features/company/EmployerRoleChangePreview.tsx` | Interactive preview and transition matrix. |
| `app/company/role-changes/page.tsx` | Page hosting the preview. |
| `__tests__/employer-role-changes.test.tsx` | Success, failure, and boundary tests. |

All access answers are derived from the existing tables in `lib/auth/roles.ts` (`NAVIGATION_ITEMS`, `ROUTE_ROLE_RULES`, `EXPORT_PERMISSIONS`, `canCancelPayroll`), so the notice cannot drift from what the sidebar and middleware actually allow.

## Kinds of change

| Kind | When | Notice tone |
| --- | --- | --- |
| `promotion` | The new role is Admin. | Green `status` |
| `demotion` | The previous role was Admin. | Amber `alert` |
| `lateral` | Operator ↔ Auditor. These roles have different, non-overlapping areas. | Indigo `status`, or amber `alert` if the current page is lost |
| `unchanged` | Same role. | No notice is rendered |

## Expected UI behavior

1. **Headline:** "Your role changed from {previous} to {new}".
2. **Now available / No longer available:** lists sidebar areas and role-gated actions (switch company, cancel payroll, each export type) that were gained or lost. A sidebar entry that is shown but disabled for a role (for example, *Employees* for operators) counts as lost.
3. **Current page:**
   - Still accessible: the user stays on the page ("You can stay on this page.").
   - No longer accessible: the notice is an `alert`, explains that the page is unavailable, and shows **Go to dashboard**, which navigates to `/`. The dashboard is reachable by every role.
4. **Session refresh:** the role is carried in the signed session, so every real change shows **Refresh session**. New permissions take effect only after the session is refreshed.
5. **Demotions:** the message warns that unsaved changes on restricted pages will not be submitted.

## Transition reference

| From → To | Areas gained | Areas lost |
| --- | --- | --- |
| Admin → Operator | None | Employees, Treasury, Compliance, Company Setup, Switch Company |
| Admin → Auditor | None | Employees, Approval Queue, Obligation Snapshots, Execute Payroll, Treasury, Company Setup, Switch Company, Signing Recovery |
| Operator → Admin | Employees, Treasury, Compliance, Company Setup, Switch Company | None |
| Operator → Auditor | Compliance | Approval Queue, Obligation Snapshots, Execute Payroll, Signing Recovery |
| Auditor → Admin | Employees, Approval Queue, Obligation Snapshots, Execute Payroll, Treasury, Company Setup, Switch Company, Signing Recovery | None |
| Auditor → Operator | Approval Queue, Obligation Snapshots, Execute Payroll, Signing Recovery | Compliance |

## Failure behavior

An unknown previous or new role (stale or tampered session, unexpected casing like `ADMIN`) never throws. The notice renders a red `alert`, "Role change could not be applied", with an actionable next step:

- Unknown previous role: "Sign out and sign back in to refresh your access."
- Unknown new role: "Sign out and sign back in, or ask a company admin to confirm your role."

The raw role value is never echoed back.

## Privacy

Only role names, navigation labels, and capability labels are shown. Wallet addresses, team member names, employee data, and salary amounts are never read or rendered by these components.
