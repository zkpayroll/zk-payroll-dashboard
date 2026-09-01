# Testing Notes

## Payroll Fixture Builder

Use reusable fake payroll fixtures when reviewing dashboard states locally. Fixtures should use fictional employee names, placeholder wallet addresses, and rounded token amounts so screenshots, logs, and issue comments never expose private payroll values.

Recommended fixture states:

- `draft`: at least one employee, unlocked, not submitted.
- `empty`: no employees and a zero total for validation checks.
- `below-minimum`: one employee below the supported payroll amount.
- `locked`: submitted or locked payroll data with editable controls disabled.

Keep fixture values deterministic so reviewers can compare the same UI states across pull requests.