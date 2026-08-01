# Admin Recovery Guide

Use this guide when wallet, network, or funding issues block payroll work. It is written for dashboard operators who need fast recovery steps before a payroll run, during proof generation, or after a failed Stellar submission.

## First response checklist

1. Pause new payroll actions until you know whether a transaction was submitted.
2. Capture the time, admin wallet address, network, transaction hash if shown, and visible dashboard error.
3. Confirm the dashboard is pointed at the expected Stellar network.
4. Check whether the treasury account has enough XLM for fees and enough payroll asset balance for the run.
5. Retry only after checking the transaction history or Stellar explorer, so you do not submit duplicate payroll operations.

## Wallet signing problems (mid-run recovery)

For signing failures that happen **after** the wallet is connected (Freighter rejected the signature prompt, the active network no longer matches the dashboard, the wallet session expired before signing, or the XDR could not be decoded), use the dedicated [Wallet Signing Failure Recovery Guide](./WALLET_SIGNING_RECOVERY_GUIDE.md). That guide is also surfaced inside the dashboard via the wallet error overlay and the help drawer.

The categories tracked for those failures map 1-to-1 across the dashboard overlay, local telemetry, and the dedicated doc:

| Dashboard overlay | Telemetry label | Guide section |
| ------------------- | ----------------- | --------------- |
| 🚫 Transaction Rejected | `wallet_rejected` | [Wallet Signing Recovery Guide § 1](./WALLET_SIGNING_RECOVERY_GUIDE.md#1-transaction-rejected-wallet_rejected) |
| 🔒 Session Expired | `session_expired` | [Wallet Signing Recovery Guide § 3](./WALLET_SIGNING_RECOVERY_GUIDE.md#3-expired-session-expired-session) |
| 🔧 Invalid Transaction Data | `malformed_tx` | [Wallet Signing Recovery Guide § 4](./WALLET_SIGNING_RECOVERY_GUIDE.md#4-malformed-transaction-data-malformed_tx) |
| ⚠️ Wrong Network | `wrong_network` | [Wallet Signing Recovery Guide § 2](./WALLET_SIGNING_RECOVERY_GUIDE.md#2-wrong-network-at-signing-time-wrong_network) |

## Wallet connection problems

### Freighter is not detected

Symptoms:

- The dashboard asks you to install Freighter even though the extension is installed.
- The connect wallet action does nothing.
- The browser extension is locked or hidden from the current browser profile.

Recovery steps:

1. Unlock Freighter and refresh the dashboard.
2. Confirm the dashboard tab has permission to access the extension.
3. Disable conflicting wallet extensions for the session if multiple Stellar wallets inject providers.
4. Open the dashboard in a normal browser window, not a restricted private profile.
5. If the problem continues, restart the browser and reconnect from the header wallet action.

### Wrong wallet account is connected

Symptoms:

- The connected address does not match `ADMIN_PUBLIC_KEY`.
- Admin-only actions are hidden or fail authorization.
- Payroll actions fail before reaching the network.

Recovery steps:

1. Disconnect from the dashboard header.
2. Switch Freighter to the intended admin account.
3. Confirm the public key matches the configured `ADMIN_PUBLIC_KEY` value.
4. Reconnect and reload the page if the old address still appears.
5. If this is a production configuration issue, rotate the environment value through the normal deployment process instead of editing it locally.

### Wallet is on the wrong network

Symptoms:

- Freighter shows Public, Futurenet, or a custom network while the dashboard expects Testnet.
- Explorer links open but cannot find recent transactions.
- Balances in the wallet do not match dashboard expectations.

Recovery steps:

1. Open Freighter settings and switch to the expected network.
2. For local development, confirm `.env.local` uses the same network values as the wallet.
3. Refresh the dashboard after changing networks.
4. Reconnect the wallet so the provider exposes the current network state.

Expected local Testnet values:

```env
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

## Network and RPC problems

### Horizon or Soroban RPC is unavailable

Symptoms:

- Payroll submission fails with a timeout.
- Transaction history stops updating.
- Wallet is connected, but balances or statuses do not refresh.

Recovery steps:

1. Check the configured Horizon and Soroban RPC URLs.
2. Open the URLs from the same network environment to rule out a local firewall or DNS problem.
3. Retry read-only dashboard actions before retrying a payroll submission.
4. If a submission may have reached the network, check the transaction hash in Stellar Expert before trying again.
5. Switch to an approved backup RPC endpoint only if your deployment process allows it.

### Transaction status is unclear

Symptoms:

- The dashboard shows a timeout after submit.
- Freighter showed an approval prompt, but the dashboard did not update.
- The history page does not show the new payroll run.

Recovery steps:

1. Search Stellar Expert for the transaction hash if the dashboard or wallet displayed one.
2. If no hash is available, inspect the admin account's recent operations in the explorer.
3. Treat a confirmed transaction as complete even if the dashboard still shows a stale state.
4. Refresh the dashboard and check the history page.
5. Do not retry the payroll run until you confirm the previous submission failed or never reached the network.

## Operation classification cheatsheet

When handing off to engineering, tag the issue with the matching telemetry label so it routes to the right team:

| Dashboard overlay | Telemetry label | Guide section |
| ------------------- | ----------------- | --------------- |
| 🚫 Transaction Rejected | `wallet_rejected` | [Wallet Signing Recovery Guide § 1](./WALLET_SIGNING_RECOVERY_GUIDE.md#1-transaction-rejected-wallet_rejected) |
| 🔒 Session Expired | `session_expired` | [Wallet Signing Recovery Guide § 3](./WALLET_SIGNING_RECOVERY_GUIDE.md#3-expired-session-expired-session) |
| 🔧 Invalid Transaction Data | `malformed_tx` | [Wallet Signing Recovery Guide § 4](./WALLET_SIGNING_RECOVERY_GUIDE.md#4-malformed-transaction-data-malformed_tx) |
| ⚠️ Wrong Network | `wrong_network` | [Wallet Signing Recovery Guide § 2](./WALLET_SIGNING_RECOVERY_GUIDE.md#2-wrong-network-at-signing-time-wrong_network) |

## Funding problems

### Treasury has insufficient payroll asset balance

Symptoms:

- Payroll submission fails before or during transaction simulation.
- The dashboard shows a low treasury balance warning.
- Some employees cannot be included in the run.

Recovery steps:

1. Open the treasury page and compare the expected payroll total with the available asset balance.
2. Fund the treasury account with the payroll asset used by the run.
3. Confirm the funding transaction on Stellar Explorer.
4. Refresh the dashboard and rerun payroll validation.
5. If the run contains inactive or incorrect employees, correct the employee directory before submitting.

### Treasury has insufficient XLM for fees or reserves

Symptoms:

- Transactions fail even though the payroll asset balance is high enough.
- Account reserve or transaction fee errors appear.
- New trustlines or contract interactions cannot be completed.

Recovery steps:

1. Check the treasury account's XLM balance.
2. Keep enough XLM for minimum reserves, trustlines, and transaction fees.
3. On Testnet, fund with Friendbot if this is a development account.
4. On production networks, follow treasury funding controls and approval policy.
5. Retry only after the funding transaction is confirmed.

Testnet funding command:

```bash
curl "https://friendbot.stellar.org?addr=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

## Proof generation problems

### Proof generation fails before submission

Symptoms:

- The dashboard reports proof generation failure.
- The payroll transaction is not sent to Freighter for approval.
- The payroll run remains pending.

Recovery steps:

1. Check whether employee records have missing or invalid payroll data.
2. Retry after refreshing the dashboard to clear stale client state.
3. If the failure is reproducible, export or record the payroll run inputs needed for debugging.
4. Do not manually mark the payroll as paid unless a network transaction was confirmed.
5. Escalate with the error message, run ID, employee count, and browser console details.

## Recovery notes by dashboard area

| Area | What to check | Recovery action |
| ------ | --------------- | ----------------- |
| Dashboard | Payroll summary cards and pending approvals | Confirm the run is still pending before retrying. |
| Employees | Active, inactive, and pending employee filters | Remove invalid employees from the run or update their status. |
| Treasury | Asset balance, XLM balance, and warnings | Fund the treasury before running payroll. |
| History | Transaction status and timestamps | Use confirmed history entries as the source of truth. |
| Compliance | View key status and expiry | Renew or revoke keys before audit access is interrupted. |

## Escalation packet

When handing off to engineering or operations, include:

- Admin wallet public key.
- Expected network and configured RPC URLs.
- Payroll run ID or timestamp.
- Transaction hash, if one exists.
- Screenshot or exact dashboard error copy.
- Whether Freighter prompted for approval.
- Current treasury XLM and payroll asset balances.
- Steps already attempted from this guide.

## Related docs

- [Dashboard setup guide](./SETUP_GUIDE.md)
- [Operator handbook](./OPERATOR_HANDBOOK.md)
- [Wallet signing failure recovery guide](./WALLET_SIGNING_RECOVERY_GUIDE.md)
- [Content style guide](./CONTENT_STYLE_GUIDE.md)
- [Stellar Testnet guide](https://developers.stellar.org/docs/network/testnet)
- [Freighter wallet docs](https://docs.freighter.app/)
- [Stellar Expert Testnet explorer](https://testnet.stellarexpert.com/)
