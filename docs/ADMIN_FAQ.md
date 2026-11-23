# ZK Payroll Dashboard - Admin FAQ

This guide answers common operational questions for administrators managing payroll runs and audit access in the ZK Payroll Dashboard.

## Table of Contents

- [Payroll Failures](#payroll-failures)
- [Missing Data & Configuration](#missing-data--configuration)
- [Audit & Compliance](#audit--compliance)
- [Reconciliation & Settlement](#reconciliation--settlement)
- [Troubleshooting](#troubleshooting)

---

## Payroll Failures

### Q: Why did my payroll run fail during submission?

**A:** Payroll failures can occur for several reasons:

1. **Incomplete Employee Data** - Check that all employees have:
   - Valid Stellar wallet addresses
   - Salary amounts greater than zero
   - Active status

2. **Insufficient Funding** - Verify the company has enough balance to cover:
   - Total payroll amount
   - Plus any buffer for transaction fees

3. **Network Issues** - Temporary network failures can cause submission to fail:
   - Check your internet connection
   - Retry the submission (use the Retry button)
   - If persistent, contact support with the transaction hash (if available)

4. **Proof Generation Error** - The ZK proof may fail if:
   - Circuit artifacts are corrupted or outdated
   - Witness data is malformed
   - System resources are exhausted (try again with fewer employees)

**Next Steps:**

- Review the error message in the Dashboard for specific details
- Check the [Troubleshooting section](#troubleshooting) below
- Contact the ZK Payroll support team with the run ID and timestamp

---

### Q: How do I recover from a failed payroll run?

**A:** To recover:

1. **Identify the failure point:**
   - Check the payroll run status in the Dashboard
   - Review the error log for the specific failure reason

2. **Fix the underlying issue:**
   - For missing data: Update employee records and rerun
   - For funding issues: Top up the company treasury, then rerun
   - For proof failures: Regenerate the proof (this may take 1-2 minutes)

3. **Retry the run:**
   - Click the "Retry" button on the failed run
   - The system uses idempotency to prevent duplicate submissions
   - Monitor progress until completion

4. **If problems persist:**
   - Wait 30 seconds and retry once more
   - If still failing, escalate to technical support with the run ID

---

### Q: What do the reconciliation badges mean?

**A:** Payroll history shows a separate reconciliation badge for each run. The badge describes the settlement comparison, not the payment submission status shown in the adjacent `Status` badge.

| Badge | Meaning | Operator action |
| --- | --- | --- |
| **Matched** | Every expected payment was reconciled. | No action required. |
| **Pending** | Reconciliation is still in progress. | Wait and refresh before investigating. |
| **Mismatched** | The comparison found a discrepancy or incomplete progress. | Open the run and review the reconciliation details. |
| **Failed** | Reconciliation could not complete. | Check the run, retry when the underlying issue is resolved, or contact support. |
| **Manually reviewed** | A reviewer acknowledged the outcome. | Read the reviewer context before changing the run. |

Legacy `Complete` and `Partial` API values are normalized to `Matched` and `Mismatched` in the UI.

**Privacy:** Badges expose only the outcome label. They do not include salaries, wallet addresses, proofs, or discrepancy text. Authorized reconciliation detail views and reports remain separate from the badge.

---

## Missing Data & Configuration

### Q: Why am I seeing "Missing Required Data" warnings?

**A:** The Dashboard validates data completeness before payroll submission. Missing fields include:

| Field | Why It's Required | How to Fix |
| ------- | ------------------- | ----------- |
| Employee Name | Audit trail and compliance | Edit the employee record, add full name |
| Stellar Address | Required for payment delivery | Verify the employee's wallet address is correct |
| Salary Amount | Core payroll data | Set the compensation amount for the pay period |
| Salary Commitment | ZK proof verification | This hash is generated when the salary is recorded |

**To resolve:**

1. Go to the Employees section
2. Find employees with incomplete data (marked with a warning icon)
3. Fill in all required fields
4. Save the changes
5. Retry the payroll run

---

### Q: How do I fix "Incomplete Configuration" warnings?

**A:** Incomplete configuration means non-critical but recommended fields are missing:

- **Email Address** - Enables notifications. Optional but recommended.
- **Department** - Used for reporting and audit grouping. Optional.
- **Start Date** - Helps with historical payroll tracking. Optional.

**These don't block payroll submission** but improve record-keeping. Add them when convenient.

---

### Q: Can I run payroll with fewer employees than planned?

**A:** Yes. You can:

1. **Exclude inactive employees** - Mark them as "inactive" before the payroll run
2. **Run partial batches** - Submit payments to a subset of active employees
3. **Reschedule absent employees** - They'll be included in the next cycle

**Important:** Always verify the total amount matches your budget before submission.

---

## Audit & Compliance

### Q: How do I grant audit access?

**A:** To grant an auditor read-only access:

1. Go to **Compliance > Audit Access**
2. Click **Grant New Access**
3. Enter the auditor's details:
   - Name and organization
   - Email address
   - Requested access level (read-only or full-audit)
   - Reason for the audit
4. Review the terms and click **Confirm Grant**
5. The auditor will receive a view key (a unique token for access)

**Access expires after:** 30 days by default (contact support to extend)

---

### Q: How do I revoke audit access?

**A:** To revoke an auditor's access:

1. Go to **Compliance > Audit Access**
2. Find the auditor in the active list
3. Click the **Revoke** button
4. In the confirmation dialog:
   - Review the auditor's details
   - Optionally provide a revocation reason (recorded for compliance)
   - Click **Revoke Access**
5. The auditor **loses immediate access** - revocation is permanent until re-granted

**The revocation is logged:**

- Timestamp of revocation
- Who revoked the access
- Reason (if provided)
- This audit trail is immutable for compliance

---

### Q: What's the difference between "read-only" and "full-audit" access?

**A:**

| Access Level   | Can View                                                            | Cannot Do                                              |
|----------------|---------------------------------------------------------------------|--------------------------------------------------------|
| **Read-Only**  | Employee records, payroll runs, transactions, proofs                | Submit payments, modify records, revoke other auditors |
| **Full-Audit** | All read-only + internal logs, reconciliation details, audit trails | Administrative actions (still read-only to data)       |

**Use read-only** for most auditors. Use **full-audit** only for internal compliance teams.

---

### Q: How long is audit access granted for?

**A:**

- **Default:** 30 days from grant date
- **Extension:** Contact support to extend (usually approved automatically)
- **Revocation:** Can be revoked at any time by admins
- **Auto-revocation:** Automatically expires after the grant period ends

---

## Reconciliation & Settlement

### Q: What does "Mismatched" mean?

**A:** "Mismatched" means that the reconciliation comparison found a discrepancy or that the run is only partially processed. The run may still be settling, or a payment may differ from the expected result.

**What to do:**

1. **Check the run** - Open the payroll run and review the progress summary.
2. **Wait when appropriate** - Settlement can take several minutes.
3. **Investigate discrepancies** - Use the authorized reconciliation details and transaction hash.
4. **Escalate persistent issues** - Include the run ID and timestamp, but do not attach private payroll data.

---

### Q: How do I check reconciliation details?

**A:** To view reconciliation progress:

1. Open a payroll run from the list
2. Scroll to **Reconciliation Status**
3. View:
   - Current reconciliation outcome (Matched, Pending, Mismatched, Failed, Manually reviewed)
   - Progress bar (X of Y payments processed)
   - Any discrepancies
   - Timestamp of last reconciliation update

4. To export details:
   - Click **Export Report** (if available)
   - Review the CSV file for line-by-line settlement details

---

### Q: What if reconciliation shows discrepancies?

**A:** Discrepancies mean the submitted amount doesn't match what was recorded on-chain.

**Common causes:**

1. **Rounding errors** - Verify decimal precision matches
2. **Partial failure** - Some payments failed (see error details)
3. **Network reorg** - A blockchain reorganization affected the transaction
4. **External interference** - Funds were moved outside the expected flow

**To investigate:**

1. Note the discrepancy description
2. Check the transaction hash in Stellar Explorer
3. Compare:
   - Expected payment amount
   - Actual amount on-chain
   - Receiver address
4. Contact support with findings

---

## Troubleshooting

### Q: The dashboard is slow or frozen

**A:**

1. **Refresh the page** - Browser cache can cause slowdowns
2. **Clear browser cache** - This resets the local data store
3. **Check your internet** - Slow connections affect real-time updates
4. **Try a different browser** - Rules out browser-specific issues
5. **Contact support** - Provide your browser version and OS

---

### Q: I can't see my recent changes

**A:** The dashboard may not have synced with the backend:

1. **Force refresh** - Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Log out and back in** - This clears all cached sessions
3. **Check your permissions** - You may lack edit permissions for this resource
4. **Wait a moment** - Changes can take 5-10 seconds to appear

---

### Q: "ZK Proof Generation Failed" - what do I do?

**A:** Proof generation failures are usually temporary:

1. **Retry immediately** - Click **Generate Proof** again
2. **Wait 30 seconds** - If you just ran a proof, the system needs cooldown time
3. **Check system resources** - Close other tabs or applications
4. **Verify data** - Ensure all employee records are complete
5. **Check with support** - If retries don't work, it may be a circuit issue

---

### Q: How do I export payroll data?

**A:**

1. **Payroll Runs:**
   - Open the Payroll Runs page
   - Click the **Export** button (top-right)
   - Choose format: CSV, JSON, or PDF

2. **Employee Records:**
   - Go to Employees
   - Select filters (if needed)
   - Click **Export**

3. **Audit History:**
   - Go to Compliance > Audit Access
   - Click **Export History**
   - Data includes all grants, revocations, and access logs

---

### Q: I'm locked out or can't log in

**A:**

1. **Reset password** - Click "Forgot Password" on the login screen
2. **Check email** - Reset link sent to registered email
3. **Verify account status** - Your account may be inactive (contact admin)
4. **Check for cookies** - Some accounts require third-party cookies enabled
5. **Contact support** - If steps above don't work, provide your email

---

## Getting Help

### Contact Support

- **Email:** <support@zkpayroll.com>
- **Telegram:** [ZK Payroll Community](https://t.me/zkpayroll)
- **Docs:** [ZK Payroll SDK Documentation](https://github.com/zkpayroll/zk-payroll-sdk/tree/main/docs)

### Provide When Reporting Issues

Include these details for faster resolution:

- **Payroll Run ID** - Found in the run details
- **Timestamp** - When the issue occurred (use dashboard timezone)
- **Error message** - Exact text from the error popup
- **Steps to reproduce** - What you did before the error
- **Browser/OS** - Browser type and version, operating system
- **Screenshot** - Visual proof of the issue (anonymize sensitive data)

---

## Related Resources

- [SDK API Reference](https://github.com/zkpayroll/zk-payroll-sdk/docs/API.md)
- [Backend Integration Guide](https://github.com/zkpayroll/zk-payroll-sdk/docs/BACKEND_INTEGRATION_GUIDE.md)
- [Deprecation Policy](https://github.com/zkpayroll/zk-payroll-sdk/docs/DEPRECATION_POLICY.md)
- [Troubleshooting Guide](https://github.com/zkpayroll/zk-payroll-sdk/docs/TROUBLESHOOTING.md)
