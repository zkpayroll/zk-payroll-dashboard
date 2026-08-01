# Wallet Signing Failure Recovery Guide

Use this guide when the dashboard reaches the **wallet signing** step and the Freighter interaction does not complete successfully. It is written for dashboard operators who are mid-run and need fast, deterministic recovery before contacting engineering.

## When to use this guide

Reach for this guide if **any** of the following are true during a payroll run, employee onboarding action, or other dashboard transaction:

- Freighter shows a popup that closes without a signed response.
- The dashboard displays one of the wallet signing overlays: `Transaction rejected`, `Session expired`, or `Invalid transaction data`.
- The dashboard shows a stale "Connecting…" or "Submitting…" state after a wallet interaction.
- A payroll run hangs at the "Approve in Freighter" step.

For wallet **connection** problems (Freighter not installed, wrong network detected at connect), use the [Admin recovery guide](./ADMIN_RECOVERY_GUIDE.md) instead. This guide focuses on what happens **after** the wallet is connected and Freighter is asked to sign a transaction.

## The four high-priority signing failure modes

These map 1-to-1 with the overlays shown by `WalletErrorOverlay` and the categories tracked by `lib/wallet/signingErrors.ts`.

| # | Category label | What you will see | What is happening |
| - | ---------------- | ------------------ | ------------------- |
| 1 | `wallet_rejected` | "🚫 Transaction Rejected" overlay | The operator clicked **Reject** (or closed the popup without approving). |
| 2 | `wrong_network` (at signing time) | "⚠️ Wrong Network" overlay | Freighter's active network no longer matches what the dapp is configured against. |
| 3 | `session_expired` | "🔒 Session Expired" overlay | Freighter was locked (inactivity or browser restart) and refused to sign. |
| 4 | `malformed_tx` | "🔧 Invalid Transaction Data" overlay | The XDR could not be decoded by Freighter or the Stellar SDK. |

---

## 1. Transaction rejected (`wallet_rejected`)

### Symptoms

- The dashboard renders the "🚫 Transaction Rejected" overlay.
- Freighter confirmation popup disappears without a result.
- `signTx(...)` in the browser console rejects with phrases like `User declined`, `User rejected`, or `User cancelled`.

### Root cause

The operator (or a delegated signer) deliberately declined the signing prompt in Freighter. No funds move and no transaction is submitted when this happens. This is the safe, expected outcome of clicking **Reject**.

### Recovery steps

1. Verify you want to proceed with the action you just attempted. If the amount, recipient, or memo looks wrong, **do not retry** — escalate first.
2. From the dashboard overlay, click **Retry** (or repeat the original action, e.g. "Submit Payroll") to send the transaction to Freighter again.
3. In Freighter, read the confirmation screen carefully:
   - Source account matches the connected admin wallet.
   - Operation type matches the dashboard action.
   - Amount, asset, and memo (if any) match what the dashboard displayed.
4. Click **Approve** in Freighter. Do not close the popup — leave it open until the dashboard confirms.
5. If the operator who connected the wallet is different from the one who should approve, disconnect, reconnect with the correct account, and retry.

### Escalate when

- The dashboard logged the rejection but the operator confirms they clicked **Approve**.
- Multiple consecutive "approvals" in Freighter still produce the rejected overlay.

---

## 2. Wrong network at signing time (`wrong_network`)

### Symptoms

- The overlay says "⚠️ Wrong Network" with the wallet network and the expected network.
- The connected wallet address looks correct, but the explorer links open on a network with no matching balances.

### Root cause

Freighter is on the wrong Stellar network for the current dashboard environment (e.g. dashboard expects `TESTNET` but Freighter is on `PUBLIC`). This can happen if the operator switched networks in Freighter after connecting, or the dashboard was re-pointed at a different network mid-session.

### Recovery steps

1. Open Freighter and confirm the active network.
2. Compare it against the dashboard. Common mismatches:
   - Dashboard `Testnet` ↔ Freighter `Public`.
   - Dashboard `Testnet` ↔ Freighter `Futurenet`.
3. In Freighter, go to **Settings → Network** and select the network the dashboard expects.
4. Return to the dashboard. The polling loop will pick up the change within a few seconds.
5. Click **Retry** on the original action. If the network mismatch persists across retries, see the [Admin recovery guide § Wallet is on the wrong network](./ADMIN_RECOVERY_GUIDE.md#wallet-is-on-the-wrong-network).

### Escalate when

- The dashboard's expected network differs from any option in Freighter.
- A production deployment shows the wrong network on a brand-new session with no local override applied.

---

## 3. Expired session (`session_expired`)

### Symptoms

- The overlay says "🔒 Session Expired" or mentions Freighter being locked.
- Freighter shows only the lock screen, or prompts for a password before it will sign.
- A connected-wallet dashboard session starts showing Auth/allow prompts again out of nowhere.

### Root cause

Freighter locked itself after inactivity, the browser was restarted, or the dapp's previously granted session was revoked. Freighter refuses to sign without re-authentication.

### Recovery steps

1. Click the Freighter extension icon in your browser toolbar.
2. Enter your Freighter password to unlock the wallet.
3. Open the dashboard's **Connect Wallet** flow again (or click **Connect** in the header) to re-grant the dashboard access.
4. Confirm the address and network still match the dashboard's expectations.
5. Click **Retry** on the original action. If Freighter still shows the lock screen, restart it: open the extension → ⋯ menu → **Reload**, then re-enter your password.

### Production safety note

For **admin accounts** with elevated privileges, treat any unexpected re-auth prompt as a possible security event. Verify no one else has access to the browser profile, rotate the wallet password if needed, and confirm the dashboard tab URL is correct before re-granting access.

### Escalate when

- Freighter refuses to unlock even with the correct password.
- A new device or browser profile is requesting access without an authorized onboarding step.

---

## 4. Malformed transaction data (`malformed_tx`)

### Symptoms

- The overlay says "🔧 Invalid Transaction Data".
- `signTx(...)` throws with phrases like `invalid xdr`, `xdr decode error`, or `envelope is invalid`.
- The error appears immediately (Freighter never shows a popup), indicating the SDK could not interpret the transaction.

### Root cause

The transaction envelope the dashboard produced could not be decoded. This is almost always one of:

1. **Stale browser state** — the dashboard tab loaded an older shell with cached jars after a deploy.
2. **Out-of-date Stellar SDK / Freighter mismatch** — the contract ID or operation template changed on the server but the client bundle is using an older SDK peer.
3. **Corrupted local storage** — a persisted wallet state was tampered with or partially migrated.

This mode is the most likely category to surface a real bug. Operators must escalate rather than retry indefinitely.

### Recovery steps

1. **Do not** click Retry blindly. Each retry uses the same envelope and will fail the same way.
2. Capture the dashboard overlay copy, the exact browser console error, the timestamp, and your payroll run ID.
3. Hard-refresh the dashboard (Cmd/Ctrl + Shift + R) to force a fresh bundle.
4. Open a **new private/incognito window** and load the dashboard there. Connect Freighter and retry the action.
5. If the failure persists across hard refresh and an incognito window, the XDR is being generated incorrectly. Stop the payroll run and escalate with the captured data.

### Escalation packet for malformed transactions

Include these in addition to the [Admin recovery escalation packet](./ADMIN_RECOVERY_GUIDE.md#escalation-packet):

- The exact browser console error text from `signTx(...)`.
- The payload `(run ID, employee count, operation type)` that produced the bad XDR.
- Whether the failure is reproducible in an incognito window.
- Network the dashboard is on (`TESTNET`/`PUBLIC`) and network Freighter was on at the moment of failure.

---

## Quick decision tree

```text
Was the sign prompt approved in Freighter?
├── Yes, but still failing      → re-check [Wrong network] or [Session expired]
├── No, popup closed            → [Transaction rejected]: click Retry and Approve
└── No popup appeared at all    → re-check [Session expired] then [Malformed transaction data]
```

## Related docs

- [Admin recovery guide](./ADMIN_RECOVERY_GUIDE.md) — wallet connection, funding, and RPC failures.
- [Operator handbook](./OPERATOR_HANDBOOK.md) — full daily-operations and troubleshooting guide.
- [Stellar Freighter docs](https://docs.freighter.app/) — wallet reference.
- [Stellar Expert explorer](https://stellar.expert/) — verify transaction hashes when status is unclear.
