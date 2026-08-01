# ZK Payroll Dashboard - Operator Handbook

## Overview

This handbook provides practical, task-oriented guidance for admins and operators running payroll through the ZK Payroll Dashboard. It covers everything from initial setup through payroll execution and troubleshooting.

## Target Audience

- Payroll administrators
- Operations team members
- System operators with admin role
- Anyone responsible for executing payroll runs

## Prerequisites

- Freighter wallet installed and configured
- Access credentials to the dashboard
- Admin or operator role assigned
- Basic understanding of Stellar blockchain

---

## Getting Started

### First-Time Setup

#### 1. Install and Configure Freighter Wallet

1. Install [Freighter wallet](https://www.freighter.app/) browser extension
2. Create a new wallet or import existing keys
3. Switch network to **Stellar Testnet** (for testing) or **Mainnet** (for production)
4. Save your recovery phrase securely

**Security Reminder:** Never share your private keys or recovery phrase. Store them in a secure password manager or hardware wallet.

#### 2. Connect to Dashboard

1. Navigate to the dashboard URL
2. Click "Connect Wallet" button
3. Approve the connection in Freighter
4. Verify your public key is displayed

#### 3. Complete Company Setup

1. Go to **Setup** page from the navigation
2. Fill in company information:
   - Company name
   - Admin wallet address (auto-filled)
   - Treasury wallet address
3. Click "Complete Setup"
4. Wait for confirmation

**Note:** The treasury wallet should be a dedicated wallet for payroll operations, separate from personal funds.

### Onboarding Checklist

The dashboard provides an onboarding checklist to guide you through initial setup:

- [ ] Connect wallet
- [ ] Complete company setup
- [ ] Add first employee
- [ ] Fund treasury wallet
- [ ] Review system status
- [ ] Run first test payroll

---

## Daily Operations

### Monitoring Dashboard Health

#### Check System Status

1. Navigate to the **Dashboard** home page
2. Review the **System Status** panel
3. Verify all systems show "Operational"

**Critical Systems:**

- **Stellar RPC**: Required for blockchain operations
- **ZK Proof Service**: Required for payroll proof generation
- **Dashboard Services**: Required for data access

#### Review Alerts and Tasks

The **Attention Required** panel surfaces urgent items:

- **Critical Alerts**: Require immediate action
- **Warning Alerts**: Review and address soon
- **Pending Tasks**: Action items for operators

**Best Practice:** Check the alerts panel at the start of each shift and before running payroll.

### Treasury Management

#### Check Treasury Balance

1. Go to **Treasury** page
2. Review current balance
3. Compare against upcoming payroll requirements

#### Fund Treasury Wallet

1. Calculate required amount for next payroll
2. Add buffer for transaction fees (recommend 10% extra)
3. Transfer funds to treasury wallet address
4. Wait for confirmation (typically 5-10 seconds on Stellar)
5. Verify balance updated in dashboard

**Security Note:** Always verify the treasury address before sending funds. Cross-check with your saved records.

---

## Running Payroll

### Pre-Payroll Checklist

Before executing payroll, verify:

- [ ] All employee records are up to date
- [ ] Treasury has sufficient balance
- [ ] System status shows all operational
- [ ] No critical alerts are active
- [ ] Payroll schedule is confirmed

### Execute Payroll Run

#### Step 1: Start Payroll Wizard

1. Navigate to **Payroll** → **Execute**
2. Click "Start New Payroll Run"
3. Review the payroll wizard introduction

#### Step 2: Select Employees

1. Review the employee list
2. Select employees to include in this run
3. Verify employee counts and status
4. Click "Continue"

**Filter Options:**

- Active employees only (recommended default)
- By department
- By salary range
- Custom selection

#### Step 3: Review Payroll Summary

1. Review total amount
2. Verify employee count
3. Check individual allocations (totals only, no individual salaries)
4. Confirm treasury balance is sufficient
5. Click "Generate Proof"

**Privacy Note:** The summary shows aggregate amounts only. Individual salary details remain private on-chain.

#### Step 4: Generate ZK Proof

The system will automatically:

1. Collect payroll data
2. Generate zero-knowledge proof
3. Verify proof validity
4. Display proof status

**Expected Time:** 30-60 seconds for typical payroll (10-50 employees)

**If Proof Generation Fails:**

- Check ZK Proof Service status
- Verify employee data is complete
- Retry after 1 minute
- Contact support if issue persists

#### Step 5: Confirm and Submit

1. Review proof generation success
2. Verify final amounts
3. Click "Submit Payroll"
4. Approve transaction in Freighter
5. Wait for blockchain confirmation

**Transaction Time:** 5-10 seconds on Stellar network

#### Step 6: Verify Completion

1. Check for success confirmation
2. Note transaction hash
3. Review payroll run detail page
4. Verify status shows "Verified"

---

## Employee Management

### Adding Employees

#### Single Employee

1. Go to **Employees** page
2. Click "Add Employee"
3. Fill in required fields:
   - Name
   - Stellar wallet address
   - Email (optional)
   - Department (optional)
   - Salary amount
4. Click "Save"

**Important:** Verify wallet addresses carefully. Incorrect addresses cannot be recovered.

#### Bulk Import

1. Go to **Employees** → **Import**
2. Download CSV template
3. Fill template with employee data
4. Upload completed CSV
5. Review import preview
6. Confirm import

**CSV Format:**

```csv
name,address,email,department,salary,startDate
John Doe,GADDRESS123...,john@example.com,Engineering,5000,2024-01-01
```

#### Import Review Queue

After bulk import:

1. Go to **Employees** → **Import Review**
2. Review flagged records
3. Fix any errors or validation issues
4. Approve validated records
5. Reject invalid records

### Managing Employee Status

#### Update Single Employee

1. Find employee in directory
2. Click employee row
3. Update fields as needed
4. Change status (Active/Inactive)
5. Save changes

#### Bulk Status Update

1. Go to **Employees** → **Bulk Update**
2. Select multiple employees
3. Choose new status
4. Add reason for change
5. Confirm update

**Use Cases:**

- Offboarding multiple employees
- Seasonal workforce changes
- Department reorganizations

---

## Payroll History and Auditing

### View Payroll History

1. Go to **History** page
2. Review list of past payroll runs
3. Use filters to narrow results:
   - Date range
   - Status
   - Employee count

### Payroll Run Details

1. Click any payroll run from history
2. Review run details:
   - Timestamp
   - Total amount
   - Employee count
   - Proof hash
   - Transaction hash
   - Status

### Compare Payroll Runs

1. Go to **History** page
2. Click "Compare Runs"
3. Select two runs to compare
4. Review comparison metrics:
   - Total amount change
   - Employee count change
   - Average per employee
   - Status comparison

**Use Cases:**

- Period-over-period audits
- Anomaly investigation
- Budget variance analysis

### Transaction Detail View

1. Navigate to any payroll run
2. Click "View Transaction Details"
3. Review comprehensive transaction information:
   - Source and destination accounts
   - Amount and fees
   - Timestamp and confirmation
   - Proof verification
   - Related operations

---

## Compliance and Auditing

### Audit Activity Feed

1. Go to **Compliance** page
2. Review recent audit activity
3. Filter by:
   - Date range
   - Event type
   - User

**Audit Events:**

- Payroll executed
- Employee added/removed
- Status changes
- View key granted/revoked
- System configuration changes

### Managing Audit Access

#### Review Access Requests

1. Go to **Compliance** page
2. Check "Pending Requests" section
3. Review auditor information
4. Verify requested scope
5. Approve or reject request

**Scopes:**

- **Read-Only**: View payroll history only
- **Full Audit**: View history and employee records

#### Grant View Keys

For approved requests:

1. System automatically generates view key
2. View key is time-limited (default: 90 days)
3. Auditor receives key credentials
4. Access is logged in audit feed

#### Revoke Access

1. Go to **Compliance** → **Active View Keys**
2. Find auditor to revoke
3. Click "Revoke Access"
4. Confirm revocation
5. Auditor loses access immediately

### Export Audit Reports

1. Go to **History** page
2. Select date range
3. Click "Print Audit Report"
4. Choose format (PDF recommended)
5. Save or print report

**Report Contents:**

- Payroll run summaries
- Transaction hashes
- Aggregate amounts
- Timestamps
- Verification status

**Privacy:** Reports contain only aggregate data. Individual salaries are not exposed.

---

## Troubleshooting

### Common Issues

#### Wallet Connection Failed

**Symptoms:**

- Dashboard shows "Connect Wallet" despite Freighter being connected
- Connection drops randomly

**Solutions:**

1. Refresh the page
2. Disconnect and reconnect wallet
3. Check Freighter is on correct network (Testnet/Mainnet)
4. Clear browser cache
5. Restart browser

#### Insufficient Treasury Balance

**Symptoms:**

- Payroll submission fails with balance error
- Transaction rejected

**Solutions:**

1. Check treasury balance on Treasury page
2. Calculate required amount including fees
3. Fund treasury wallet
4. Wait for confirmation (5-10 seconds)
5. Retry payroll submission

#### Proof Generation Timeout

**Symptoms:**

- ZK proof generation takes longer than 2 minutes
- Proof generation fails with timeout error

**Solutions:**

1. Check System Status for ZK Proof Service
2. Verify all employee data is complete
3. Try with smaller employee batch
4. Wait 2 minutes and retry
5. Contact support if issue persists

#### Transaction Signing Failure Mid-Run

**Symptoms:**

- The dashboard overlays one of: "🚫 Transaction Rejected", "🔒 Session Expired", or "🔧 Invalid Transaction Data".
- Freighter closes its confirmation popup without producing a signed transaction.
- A payroll run hangs at the "Approve in Freighter" step.

**Solutions:**

1. Open the [Wallet Signing Failure Recovery Guide](./WALLET_SIGNING_RECOVERY_GUIDE.md) and follow the section that matches the overlay you see.
2. For rejections: verify the transaction details, click **Retry**, and approve in Freighter without closing the popup.
3. For session-expired: unlock Freighter and re-connect from the header.
4. For malformed-tx: hard-refresh the dashboard and try again in an incognito window. If the failure persists, escalate.
5. Capture the overlay text, the console error, and the payroll run ID before retrying, so escalation has the full picture.

#### Transaction Confirmation Delayed

**Symptoms:**

- Transaction submitted but not confirming
- Status stuck on "Pending"

**Solutions:**

1. Check System Status for Stellar RPC
2. Check Stellar network status
3. Wait up to 30 seconds for confirmation
4. Verify transaction on Stellar explorer
5. Contact support if still pending after 2 minutes

#### Employee Import Errors

**Symptoms:**

- CSV import fails validation
- Some records rejected

**Solutions:**

1. Download CSV template again
2. Verify required fields are present
3. Check wallet address format (starts with G, 56 characters)
4. Ensure salary amounts are numeric
5. Verify date format (YYYY-MM-DD)
6. Remove special characters from names

### System Status Issues

#### RPC Connection Degraded

**Impact:** Slower transaction processing, delayed confirmations

**Actions:**

1. Check alerts panel for updates
2. Delay non-urgent payroll runs
3. Monitor RPC status
4. Continue with urgent payroll (will be slower)

#### ZK Proof Service Down

**Impact:** Cannot generate proofs, payroll runs blocked

**Actions:**

1. Do not start new payroll runs
2. Check incident page for updates
3. Wait for service restoration
4. Monitor alerts panel

#### Dashboard Services Degraded

**Impact:** Slower page loads, data sync delays

**Actions:**

1. Avoid bulk operations
2. Save work frequently
3. Refresh page if data appears stale
4. Monitor system status

### Getting Help

#### Support Channels

- **Documentation**: Check [docs/](.) for guides
- **Incident Page**: `/incidents` for system status
- **Runbook**: `/incidents/runbook` for operational procedures
- **Architecture Docs**: `docs/ARCHITECTURE.md` for technical details

#### Escalation Path

1. Check this handbook first
2. Review relevant documentation
3. Check System Status and Incidents page
4. Collect error details (screenshots, transaction hashes)
5. Contact technical support with:
   - Timestamp of issue
   - Steps to reproduce
   - Error messages
   - Transaction hashes (if applicable)

---

## Best Practices

### Security

- **Never share private keys**: Use Freighter, not raw keys
- **Verify addresses**: Always double-check wallet addresses before transactions
- **Regular backups**: Export and securely store employee records
- **Access control**: Limit admin access to authorized personnel only
- **Audit regularly**: Review audit activity feed weekly

### Privacy-Sensitive Workflows

The ZK Payroll system is designed to protect employee privacy:

- Individual salaries are never exposed on-chain
- Zero-knowledge proofs verify correctness without revealing amounts
- Comparison views show aggregates only
- Audit reports contain summaries, not individual records

**Operator Responsibilities:**

- Do not share employee salary information
- Use comparison tools for analysis, not individual queries
- Grant audit access only when necessary and with appropriate scope
- Revoke audit access promptly when no longer needed

### Operational Excellence

#### Daily Routine

- [ ] Check System Status at shift start
- [ ] Review Attention Required panel
- [ ] Monitor treasury balance
- [ ] Process any pending employee updates
- [ ] Review audit activity feed

#### Weekly Routine

- [ ] Review payroll history for anomalies
- [ ] Check upcoming payroll schedule
- [ ] Verify employee records are current
- [ ] Review and respond to audit requests
- [ ] Export weekly audit reports

#### Monthly Routine

- [ ] Compare payroll runs month-over-month
- [ ] Review compliance and audit logs
- [ ] Update employee records for changes
- [ ] Verify treasury funding patterns
- [ ] Review and revoke unnecessary audit access

### Performance Tips

- **Batch employee updates**: Use bulk import instead of one-by-one
- **Schedule payroll**: Run during off-peak hours when possible
- **Monitor ahead**: Check system status before starting large operations
- **Use filters**: Leverage filtering in history and employee directory
- **Stay informed**: Read release notes for new features and improvements

---

## Related Resources

### Dashboard Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Setup Guide](./SETUP_GUIDE.md)
- [Admin recovery guide](./ADMIN_RECOVERY_GUIDE.md)
- [Wallet signing failure recovery guide](./WALLET_SIGNING_RECOVERY_GUIDE.md)
- [Feature Demo](./FEATURE_DEMO.md)
- [Transaction Details](./TRANSACTION_DETAIL_USAGE.md)
- [Visual Regression Testing](./VISUAL_REGRESSION_TESTING.md)

### Stellar and ZK Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Smart Contracts](https://soroban.stellar.org/)
- [Freighter Wallet](https://www.freighter.app/)
- Zero-Knowledge Proofs: See `lib/zk/` for implementation

### Contract and SDK Concepts

- **Payroll Contract**: Soroban smart contract managing payroll operations
- **ZK Proof System**: Generates privacy-preserving proofs of correct payroll calculations
- **Treasury Management**: On-chain treasury wallet for funding payroll
- **View Keys**: Time-limited read access for auditors

---

## Appendix

### Glossary

- **Admin**: User with full access to all dashboard features
- **Operator**: User who can execute payroll and manage employees
- **Auditor**: External party with read-only access via view key
- **Treasury**: Company wallet that funds payroll transactions
- **ZK Proof**: Zero-knowledge proof that verifies payroll correctness without revealing salaries
- **View Key**: Time-limited credential granting audit access
- **Payroll Run**: Single execution of payroll for multiple employees
- **Transaction Hash**: Unique identifier for blockchain transaction

### Keyboard Shortcuts

The dashboard supports common keyboard shortcuts:

- `Ctrl/Cmd + K`: Open command palette (future feature)
- `Esc`: Close modal dialogs
- `Tab`: Navigate form fields
- `Enter`: Submit forms

### Common Error Codes

- `INSUFFICIENT_BALANCE`: Treasury balance too low
- `INVALID_PROOF`: ZK proof verification failed
- `TX_TIMEOUT`: Transaction took too long to confirm
- `RPC_ERROR`: Stellar RPC connection issue
- `PROOF_SERVICE_ERROR`: ZK proof generation failed

---

## Feedback

This handbook is a living document. If you encounter issues not covered here or have suggestions for improvements:

1. Document your use case
2. Note what information would have helped
3. Submit feedback through appropriate channels
4. Check back for updates in future releases

---

**Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: ZK Payroll Team
