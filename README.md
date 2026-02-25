![CI Status](https://github.com/zk-payroll/zk-payroll-dashboard/actions/workflows/ci.yml/badge.svg)
![CD Status](https://github.com/zk-payroll/zk-payroll-dashboard/actions/workflows/deploy.yml/badge.svg)

# ZK Payroll Dashboard

The **ZK Payroll Dashboard** is a privacy-first web application designed for managing decentralized payroll operations on the Stellar network. It leverages Zero-Knowledge Proofs (ZKPs) to ensure salary amounts and payment details remain confidential while maintaining on-chain verifiability.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/built%20with-Next.js-black)
![Stellar](https://img.shields.io/badge/network-Stellar%20Soroban-purple)

## 🚀 Features

- **Connect Wallet**: Seamless integration with Stellar-compatible wallets (Freighter, Albedo).
- **Privacy-Preserving Payroll**: Execute batch payroll transactions where salary amounts are hidden using ZK commitments.
- **Employee Management**: Register and manage employees with encrypted metadata.
- **Transaction History**: verifiable history of all payroll events.
- **Compliance View**: Optional view-key generation for auditing purposes.

## 🛠 Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Blockchain Interaction**: `@zk-payroll/sdk`, `stellar-sdk`

## 📦 Prerequisites

- Node.js 18+
- npm or yarn
- A Stellar testnet account (funded via Friendbot)

## ⚡️ Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/zkpayroll/zk-payroll-dashboard.git
   cd zk-payroll-dashboard
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Environment**
   Copy the example env file and adjust values as needed:

   ```bash
   cp .env.example .env.local
   ```

   The default variables (already set for Stellar Testnet):

   ```bash
   NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
   NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
   NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## 🏗 Project Structure

```
zk-payroll-dashboard/
├── app/                  # Next.js App Router pages
│   ├── globals.css       # Global styles & Tailwind directives
│   ├── layout.tsx        # Root layout with providers
│   └── page.tsx          # Dashboard home
├── components/           # React UI components
│   ├── layout/           # Structural components (Sidebar, Header)
│   ├── ui/               # Reusable UI elements (Buttons, Cards)
│   ├── PayrollSummary.tsx
│   ├── TransactionHistory.tsx
│   └── WalletConnect.tsx
├── lib/                  # Utilities and helper functions
├── public/               # Static assets
└── package.json
```

## 📖 Usage Guide

### 1. connect Wallet

Click the **"Connect Wallet"** button in the top right header. Select your preferred Stellar wallet.

### 2. Processing Payroll

Navigate to the **Dashboard** tab. You will see a summary of active employees and total payroll volume. Click "Process Payroll" to initiate a ZK-proof generation for the current pay period.

### 3. Verification

Once the transaction is confirmed, it will appear in the **Transaction History** table. The "Verified" status indicates that the on-chain ZK verifier successfully validated the payment proof.

## 🤝 Contributing

Contributions are welcome! Please check out the [issues](https://github.com/zkpayroll/zk-payroll-dashboard/issues) page.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
