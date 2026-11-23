# Payout token error codes

Settlement review checks each payout group's token against the supported
payroll allowlist in `lib/assets/supportedAssets.ts` (currently USDC, XLM, EURC).
Validation lives in `lib/assets/payoutTokenValidation.ts`.

Matching is case-insensitive and ignores surrounding whitespace, so `usdc ` is treated as `USDC`.

| Code | When | Behavior |
| --- | --- | --- |
| `UNSUPPORTED_PAYOUT_TOKEN` | The token is not on the supported list. | Shows an error banner in settlement review and disables submit. |
| `PAYOUT_TOKEN_MISSING` | The token is empty, whitespace-only, or not a string. | Shows an error banner in settlement review and disables submit. |

Messages name only the asset code and the supported list. They never include
amounts, employee identities, wallet addresses or counts. Codes longer than
12 characters, or containing characters outside `A-Z0-9`, are not echoed.
