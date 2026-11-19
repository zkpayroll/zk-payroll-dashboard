# Operations UI guidance

This reference captures the small, operator-facing behavior contracts for the
treasury, reconciliation, and administrative-settings screens. Guidance must
never reveal employee identities, wallet addresses, salary amounts, proofs, or
raw receipt contents.

## Asset decimal precision

Treasury amounts are displayed using the asset's configured decimal precision.
The UI should label a value as a display value, not a rounded settlement value,
and should direct operators to the asset configuration when the displayed scale
is unexpected. Error copy should state the accepted precision and the next
action without echoing payroll values.

## Settlement receipt replay

Replaying a settlement receipt is an idempotent reconciliation action. The UI
should identify whether the receipt is already processed, pending, or needs
review, then provide a safe next action. A replay result must show operational
status only; receipt payloads and payment details belong in authorised audit
views.

## Administrative pause state

When an administrative pause is active, settings screens should show a clear
status indicator and explain that new affected actions are temporarily blocked.
Existing records remain visible. Resuming should require the same permission
level as pausing and should be reflected in the audit trail.

## Component-test baseline

Component coverage for these states should assert the visible status, the
actionable next step, and the absence of sensitive payroll data in labels,
tooltips, and errors. Boundary coverage should include an asset at its maximum
display precision, an already-replayed receipt, and a paused-to-resumed state
transition.
