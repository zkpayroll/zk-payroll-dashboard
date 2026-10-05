# Content Style Guide

A lightweight guide for writing consistent UX copy across the ZK Payroll Dashboard.

## 🎯 Tone & Voice

| Attribute | Standard |
| ----------- | ---------- |
| **Tone** | Professional, reassuring, and direct |
| **Voice** | Active voice, second-person ("you") when addressing the user |
| **Sentence length** | Keep under 25 words where possible |
| **Jargon** | Minimize; explain when necessary |
| **Punctuation** | Use sentence case everywhere (no title case for UI labels) |

### Examples

| ✅ Do | ❌ Don't |
| ------- | ---------- |
| "Connect your wallet to get started" | "Connect Wallet To Get Started" |
| "No employees yet" | "You Have No Employees" |
| "Add employees to get started with payroll." | "Employee Addition Required for Payroll Initiation" |
| "Dashboard data will appear after company setup is complete." | "Dashboard Data Requires Company Configuration" |

## 🏷 Status Labels

Use these exact labels consistently across the app.

| Status | Usage | Badge Style |
| -------- | ------- | ------------- |
| `verified` | Payroll transaction verified on-chain | Green (`bg-green-100 text-green-800`) |
| `pending` | Transaction submitted but not yet confirmed | Yellow (`bg-yellow-100 text-yellow-800`) |
| `failed` | Transaction rejected by the network | Red (`bg-red-100 text-red-800`) |
| `active` | Employee currently enrolled and paid | Green (`bg-green-100 text-green-800`) |
| `inactive` | Employee no longer receiving payroll | Gray (`bg-gray-100 text-gray-600`) |
| `pending` (employee) | New employee awaiting first payment | Yellow (`bg-yellow-100 text-yellow-800`) |

### Status Wording Rules

- **Always lowercase** in status badges
- **Never** truncate status text
- **Never** add icons inside badges
- Use the exact strings above — no synonyms ("confirmed" → use "verified")

## ⚠️ Error Messages

### Pattern

```text
[Action] failed: [specific reason]. [Optional next step].
```

### Message Catalog

| Scenario | Error Copy |
| ---------- | ------------ |
| Wallet connection failure | "Failed to connect wallet. Ensure Freighter is unlocked and on Testnet." |
| Proof generation failure | "Proof generation failed: circuit constraint mismatch. Please retry." |
| Transaction submission failure | "Submission failed: network timeout. The transaction may still be processing." |
| Unknown error | "An unexpected error occurred. Please try again." |
| Empty search results | "No results match the current filters." |
| Missing wallet | "Freighter not detected. Install the extension and refresh." |

### Error Tone Rules

- **Do not blame the user** — avoid "You entered..." or "Your wallet..."
- **Do not over-technical** — avoid raw error codes in user-facing messages
- **Do provide a next step** whenever possible
- **Do use "we"** for system-side issues ("We couldn't verify the proof")

## 🔔 Success & Confirmation Messages

| Scenario | Confirmation Copy |
| ---------- | ------------------- |
| Wallet connected | "Wallet connected" (announced via screen reader) |
| Proof generated | "Proof generated successfully" |
| Payroll submitted | "Payroll submitted successfully — Transaction submitted to the Stellar network." |
| View key generated | "View key generated — Auditor access has been granted." |
| View key revoked | "View key revoked — Auditor access has been immediately revoked." |
| CSV exported | (No toast — silent success) |

## ⚡ Warning Messages

| Scenario | Warning Copy |
| ---------- | -------------- |
| Company not set up | "Company setup required — Complete your company setup to start managing payroll." |
| Action required (pending approvals) | "Action required" |
| Low treasury balance | "Treasury balance is low — Fund your account before the next pay run." |
| Expiring view key | "View key expires soon — Renew before [date] to avoid audit interruption." |

## 📖 Core Terminology

Use these terms consistently throughout the dashboard. For a comprehensive reference covering terms across the dashboard, SDK, and smart contracts, see the [Shared Terminology Guide](./TERMINOLOGY.md).

| Term | Definition | Usage Notes |
| ------ | ------------ | ------------- |
| **Payroll** | The process of paying employees for a given period | Not "salary run" or "pay cycle" |
| **Payroll run** | A single batch of payments in one period | |
| **Proof** | A zero-knowledge proof verifying payroll correctness | Short for "ZK proof" |
| **Proof generation** | The process of computing a ZK proof | |
| **View key** | A cryptographic key granting auditor read access | Not "audit key" or "disclosure key" |
| **Auditor** | An external party reviewing payroll records | |
| **Treasury** | The Stellar account holding payroll funds | |
| **Commitment** | A cryptographic commitment hiding a salary amount | |
| **Testnet** | The Stellar test network for development | Always capitalize "Testnet" |
| **Freighter** | The Stellar wallet browser extension | Always capitalize "Freighter" |

## 🧩 Empty-State Copy Templates

Empty states should follow this pattern:

```text
Title: [Noun] + [missing-state verb]
Description: [What to do next] + [optional benefit]
```

Examples:

- "No employees yet → Add employees to get started with payroll."
- "No transactions yet → Process your first payroll to see it here."
- "No view keys generated → Generate a view key to grant auditor access."

## 📝 General Guidelines

1. **Accessibility**: Use `aria-live="polite"` on dynamic status messages.
2. **Brevity**: Keep tooltips under 15 words.
3. **Consistency**: Reuse the strings above rather than writing new ones.
4. **Localization-ready**: Avoid idioms that don't translate well.
5. **Button labels**: Use verbs ("Connect Wallet", "Set up now", "Retry").
6. **Links vs Buttons**: Use links for navigation (`<a>`), buttons for actions (`<button>`).
