# Employer role refresh before payroll submission

A role shown in the dashboard can go stale: an admin may have changed it, or the
session may have been revoked, since the page loaded. The payroll create form
therefore re-reads the role from `GET /api/auth/session` (`cache: "no-store"`,
5 second timeout) every time it is submitted, and decides with that role.

`refreshEmployerRole()` (`lib/auth/refreshEmployerRole.ts`) returns:

| Status | When | What the form does |
| --- | --- | --- |
| `fresh` | The server confirmed `admin`, `operator` or `auditor`. | Applies the role, shows a notice if it changed, then runs the normal permission check. |
| `session_invalid` | 401/403/404, or a body with no valid role. | Blocks the submission and asks the user to sign in again. Not retryable. |
| `unavailable` | Network error, timeout, 5xx, or a body that is not JSON. | Blocks the submission with "Nothing was submitted" and allows a retry. |

A role that cannot be confirmed is never treated as allowed. Only the role name
is read from the response; nothing else in the body is stored or shown.

The decision is recorded in the retry decision log with the reason code
`role_refresh_failed` (or `permission_denied` when the fresh role lacks
`create:payroll`).
