# Pending approval requests

The amendment approval and obligation-snapshot lock approval screens permit one
in-flight approval per mounted screen. A synchronous ref guards the handler
before React commits its pending UI; disabling a rendered button alone does not
cover multiple calls within one render batch.

## Behaviour

- A permitted click starts one approval and displays a disabled pending action
  inside an accessible busy status.
- Repeated clicks while that request is unresolved are ignored, including a
  parent refreshing metadata for the same record.
- On success the existing approved/locked screen is shown.
- On rejection the guard is released and a generic error allows an explicit
  retry. Provider exception text is not rendered or logged by these handlers.
- A route change or unmount invalidates the previous request's UI updates. Its
  late settlement cannot unlock or complete the next record's request.
- Existing SDK validation for stale, blocked, invalid or already-approved records
  remains in place. The synchronous executive-approval store is unchanged.

## Optional approval adapter

Both components accept `onApprove?: (id: string) => Promise<void>`. Existing
callers need not change: without an adapter the existing 600 ms local simulation
is preserved. Passing an adapter is a way to integrate an asynchronous SDK call
and test actual rejection/retry handling without replacing the component.

The adapter must resolve only after confirmed approval. Before rejecting with a
retryable failure it must reconcile an uncertain remote outcome or use a backend
idempotency key, so retrying cannot repeat a completed remote action. This
client-side guard is not a server-side idempotency mechanism, transaction
cancellation, or a guarantee across tabs, remounts, users or devices. No wallet
signing or real transaction submission is added by this change.

## Regression tests

```sh
npm test -- __tests__/approval-single-flight.test.tsx \
  __tests__/amendments.test.tsx __tests__/snapshots.test.tsx \
  --maxWorkers=1 --pool=threads
```

The regression file uses synthetic SDK fixtures and manually settled promises.
For each screen it covers batched repeat clicks, pending UI, same-record refresh,
success, rejected and synchronous-failure retries, stale-record validation,
route changes with late success/failure, and unmount/remount isolation. The
original default-simulation regression fails against the unpatched components:
three clicks schedule three approval timers instead of one.
