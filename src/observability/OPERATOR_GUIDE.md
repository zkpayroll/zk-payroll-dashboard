# Operator & Support Incident Replay Guide

This guide provides support operators and system administrators with instructions on how to use the **Payroll Observability & Incident Replay** system while maintaining strict privacy and zero data leakage.

---

## 🔒 Security & Data Privacy Policy

The payroll observability system is designed from the ground up to prevent sensitive financial and personal data leakage into logs, telemetry, or support incident tickets.

> [!IMPORTANT]
> **Strict Support Workflow Directive ("Don't Ask the User For X")**:
> When diagnosing payroll issues, support operators **MUST NEVER** request, record, or share:
> 1. ❌ **Salary amounts or payment figures** (e.g. "How much was the payroll for employee X?")
> 2. ❌ **Employee personal identifiers** (e.g. employee SSNs, full legal names, home addresses, or personal emails)
> 3. ❌ **Wallet private keys, secret keys, or seed phrases** (e.g. Freighter secret keys, Stellar secret seed phrases `S...`)
> 4. ❌ **Zero-Knowledge proof private inputs** (e.g. secret blinding factors, salary commitments, private witness data)

---

## ✅ What is SAFE to View and Share?

All events emitted by the payroll observability layer pass through a central redaction choke point (`redactEvent`) with fail-safe defaults. The following fields are safe for operators to inspect, include in incident reports, and request from users:

| Information Type | Safe Value / Format | Purpose |
| :--- | :--- | :--- |
| **Correlation ID** | `pay_run_1722278400000_a1b2c3d4` | Unique identifier to replay the timeline of a specific run. |
| **Stage Name** | `draft`, `validation`, `proof_setup`, `wallet_signing`, `tx_submission`, `polling`, `failure`, `retry`, `reconciliation` | Pinpoints where the execution halted. |
| **Stage Status** | `started`, `succeeded`, `failed`, `retried` | Tracks progress state. |
| **Timestamps & Durations** | ISO 8601 timestamps & `durationMs` | Measures performance and timeout bottlenecks. |
| **Error Categories** | `user_rejected`, `wrong-network`, `expired-session`, `malformed-transaction`, `circuit_error`, `network_timeout` | Identifies root cause category without leaking payload context. |
| **Employee Reference Hashes** | `emp_ref_a1b2c3d4` | Non-reversible, salted SHA-256 hash used to correlate individual records without exposing employee IDs. |
| **Network & Assets** | `testnet` / `pubnet`, `XLM` / `USDC` | Verifies blockchain network and token configuration. |

---

## 🛠️ How to Replay an Incident Timeline

1. Obtain the **Correlation ID** (e.g. `pay_run_...`) from the user or from the system audit log.
2. Open the Incident Replay Panel in the Dashboard UI (`<IncidentTimeline correlationId="..." />`).
3. Inspect the stage progression:
   - Check which stage turned red (`failed`).
   - Read the **Error Category** (e.g., `user_rejected` indicates the user declined the wallet prompt; `wrong-network` indicates wallet passphrase mismatch).
   - Review stage `durationMs` to check for network timeout issues.
   - Click **"View Redacted Context"** to inspect allowed metadata without risking PII exposure.

---

## 🛑 What to do if an Unclassified Field is Detected?

The redaction engine employs a **fail-safe default**: any payload field that is not explicitly present in the non-sensitive allowlist is automatically replaced with `[REDACTED_UNCLASSIFIED]`.

If you see `[REDACTED_UNCLASSIFIED]` in an incident payload:
- It is safe to copy and view (the value has already been safely stripped).
- If the field is a new non-sensitive metadata metric (e.g., a new timing metric), notify engineering to submit a PR adding it to `ALLOWED_METADATA_KEYS` in `src/observability/redaction.ts`.
