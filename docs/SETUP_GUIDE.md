# Dashboard Setup Guide

A step-by-step guide for running the ZK Payroll Dashboard locally with a realistic Stellar testnet setup.

## 📋 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| npm / pnpm | Latest | Package manager |
| Freighter Wallet | Chrome / Firefox extension | Stellar wallet for testnet |
| Git | Latest | Version control |

## 🚀 Quick Start

### 1. Clone and install

```bash
git clone https://github.com/zkpayroll/zk-payroll-dashboard.git
cd zk-payroll-dashboard
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

The default values point to Stellar Testnet:

```env
# ── Stellar Network ──────────────────────────────────────────
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# ── Session & Admin ──────────────────────────────────────────
SESSION_SECRET=your-secret-key-at-least-32-characters-long
ADMIN_PUBLIC_KEY=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

> ⚠️ Replace `SESSION_SECRET` with a strong random string (at least 32 characters).
> Replace `ADMIN_PUBLIC_KEY` with your own Stellar testnet public key (see Wallet Setup below).

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔐 Wallet Setup (Freighter)

### Install Freighter

1. Visit the [Freighter Wallet](https://freighter.app/) page.
2. Install the browser extension for Chrome or Firefox.
3. Create a new wallet or import an existing Stellar secret key.

### Switch to Testnet

1. Open Freighter (click the extension icon).
2. Go to **Settings → Network**.
3. Select **Testnet**.
4. Confirm the network indicator shows "Testnet".

## 🪙 Fund Your Testnet Account

### Option A: Friendbot (Recommended)

Use Stellar's Friendbot to fund a new testnet account:

```bash
curl "https://friendbot.stellar.org?addr=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

Replace the address with your Freighter wallet's public key.

**Expected response:**
```json
{
  "hash": "...",
  "result_codes": { "transaction": "tx_success" },
  ...
}
```

### Option B: Stellar Lab

1. Go to [Stellar Lab](https://lab.stellar.org/).
2. Switch the network to **Testnet**.
3. Navigate to the **Friendbot** tab.
4. Paste your public key and click **Get Testnet Lumens**.

### Verify the Balance

1. Open Freighter.
2. Your balance should now show ~10,000 testnet XLM.

## 🔄 Configure Your Admin Key

After your wallet is funded:

1. Copy your **public key** from Freighter (click on your account → Copy Address).
2. Open `.env.local`.
3. Set `ADMIN_PUBLIC_KEY` to your public key.

```
ADMIN_PUBLIC_KEY=GBXT...YOUR_PUBLIC_KEY_HERE...J29M
```

## 🧪 Run the Smoke Tests

The project includes smoke tests that verify the critical user journeys:

```bash
npm run test:smoke
```

These cover:
- Wallet connection states (connect, disconnect, loading, error)
- Payroll initiation (summary cards, proof generation)
- Dashboard status (history table, status visibility)

## ✅ Validation Checklist

Use this checklist to confirm the dashboard is wired correctly:

### Wallet Connection
- [ ] Freighter shows **Testnet** network
- [ ] Freighter is unlocked and funded
- [ ] Clicking **Connect Wallet** on the dashboard triggers Freighter
- [ ] The wallet address (truncated) is displayed in the header
- [ ] The dropdown shows "View on Stellar Expert" and "Copy Address"
- [ ] Disconnecting clears the wallet state

### Dashboard Home
- [ ] After connecting, the company setup banner appears (if no company)
- [ ] Clicking **Set up now** navigates to `/setup`
- [ ] Dashboard displays payroll summary cards (Total Payroll, Active Employees, Pending Approvals)
- [ ] Mock ZK proof generation works and shows a commitment hash

### Employee Directory
- [ ] `/employees` shows the employee directory with filter buttons
- [ ] All / Active / Inactive / Pending filters work
- [ ] Empty state is shown when no employees match a filter

### Transaction History
- [ ] `/history` shows transaction history table
- [ ] Filters panel can be opened/closed
- [ ] Status, employee, date range, and payroll run filters work
- [ ] CSV export downloads a file with filtered results
- [ ] "No transactions match the current filters" appears when no results

### Compliance / Audit
- [ ] `/compliance` shows Auditor Access Management
- [ ] Generating a new view key creates an active key entry
- [ ] Revealing a key shows the full key ID
- [ ] Revoking a key marks it as inactive
- [ ] Expired keys are visually distinguishable

### Navigation
- [ ] Sidebar links navigate correctly: Dashboard, Employees, History, Compliance
- [ ] The active page is highlighted in the sidebar

## 🐛 Troubleshooting

For a comprehensive list of issues covering CI failures, dependency mismatches, build errors, test failures, and environment misconfiguration, see the [Troubleshooting Guide](./TROUBLESHOOTING.md).

### "Freighter not detected"
- Ensure Freighter is installed and unlocked
- Refresh the page after installing
- Check that Freighter is not in "Public" or "Futurenet" mode

### "Failed to connect wallet"
- Make sure your testnet account is funded
- Try unlocking and re-locking Freighter
- Check the browser console for detailed errors

### "Horizon request failed"
- Verify `.env.local` has the correct URLs
- Testnet Horizon should be `https://horizon-testnet.stellar.org`
- Check your internet connection

### "Port 3000 already in use"
```bash
# Kill the process on port 3000
lsof -ti:3000 | xargs kill -9
# Or use a different port
npm run dev -- -p 3001
```

## 📚 Additional Resources

- [Admin Recovery Guide](./ADMIN_RECOVERY_GUIDE.md)
- [Stellar Testnet Guide](https://developers.stellar.org/docs/network/testnet)
- [Freighter Wallet Docs](https://docs.freighter.app/)
- [Stellar Expert Explorer](https://testnet.stellarexpert.com/)
