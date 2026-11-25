# Treasury token transfer guidance

`TreasuryView` accepts an optional `tokenTransferOutcome` for a transfer integration to provide a privacy-safe status. Confirmed outcomes show no failure alert. Failed outcomes show allowlisted guidance; unknown reasons use generic guidance. An unknown transaction status is not presented as a confirmed failure. All failure and uncertain-status guidance asks the operator to check the transaction status before retrying to avoid a duplicate transfer.

The dashboard currently has no on-chain treasury funding implementation: Add Funds displays a coming-soon message. This UI does not submit, retry, or monitor transfers, and it does not claim that RPC submission is final settlement. A future transfer integration must supply confirmed, failed, or unknown status from its own authoritative transaction lifecycle. It must not pass raw provider errors, employee data, salary amounts, addresses, or transaction payloads into the UI.

Run focused coverage with `npm test -- __tests__/token-transfer-status.test.tsx`.
