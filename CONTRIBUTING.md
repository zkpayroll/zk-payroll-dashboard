# Contributing to ZK Payroll Dashboard

Thank you for your interest in contributing! This project is part of the **Stellar Wave Program**.

## Getting Started

Clone and install (repo uses `package-lock.json`; prefer `npm` but `pnpm` also works — see Troubleshooting):

```bash
git clone https://github.com/your-org/zk-payroll-dashboard.git
cd zk-payroll-dashboard
npm install        # or: pnpm install
cp .env.example .env.local
# then edit .env.local — set SESSION_SECRET (≥32 random chars) and ADMIN_PUBLIC_KEY (your G... testnet address)
npm run dev        # or: pnpm dev → http://localhost:3000
```

> Full, copy-paste-friendly reference: see [docs/setup.md](docs/setup.md) (env vars, run commands, install fixes) and the longer [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) (wallet funding, validation checklist).

### Environment variables

| Variable | Required | Example | Notes |
| ---------- | ---------- | --------- | ------- |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Yes | `TESTNET` | `TESTNET` for local dev; `PUBLIC` for mainnet only. |
| `NEXT_PUBLIC_HORIZON_URL` | Yes | `https://horizon-testnet.stellar.org` | Must match network. |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Yes | `https://soroban-testnet.stellar.org` | Soroban RPC matching network. |
| `SESSION_SECRET` | Yes | 32+ random chars | `openssl rand -base64 32`. Short values throw at boot (`lib/env.ts`). |
| `ADMIN_PUBLIC_KEY` | Yes | `G...` (56 chars) | Stellar public key of company admin (Freighter → Copy Address). |

The defaults in `.env.example` already point to Stellar Testnet — just replace `SESSION_SECRET` and `ADMIN_PUBLIC_KEY` locally. Never commit `.env.local`. Validation lives in `lib/env.ts` and never logs secrets.

### Local run commands

```bash
npm run dev          # dev server on 3000 (or: npm run dev -- -p 3001)
npm run build        # production build
npm start            # serve built app
npm run lint         # Next.js / ESLint
npm run lint:md      # markdownlint  |  npm run lint:md:fix  (auto-fix)
npm run typecheck    # tsc --noEmit
npm test             # all unit tests (vitest run)
npm run test:smoke   # critical journeys: wallet, payroll, history
npm run test:watch   # watch mode
```

`npm` vs `pnpm`: repo commits `package-lock.json`. Prefer `npm install`; if you use `pnpm`, remove the other lockfile before committing. Do not commit both.

### Common install problems

| Problem | Fix |
| --------- | ----- |
| Node too old (`EBADENGINE`) | Install Node 18+ (20 LTS recommended): `nvm install 20 && nvm use 20`, then `rm -rf node_modules && npm install`. |
| Missing `.env.local` / `Invalid environment variables` | `cp .env.example .env.local`, set 32+ char `SESSION_SECRET` and `G...` admin key, restart dev server. |
| `SESSION_SECRET` too short | `openssl rand -base64 32` → paste into `.env.local`. |
| Port 3000 in use | Kill process on 3000 (`lsof -ti:3000`) or use `npm run dev -- -p 3001`. |
| Freighter not detected | Install/unlock Freighter, refresh, switch to **Testnet** in Settings → Network. |
| Horizon / Soroban RPC errors | Check `.env.local` URLs match `NEXT_PUBLIC_STELLAR_NETWORK`; verify Testnet vs Public. |

See [docs/setup.md](docs/setup.md#common-install-problems--fixes) for the full table (Horizon, Friendbot, pnpm vs npm, etc.) and QA steps.

## Development

```bash
npm run dev          # Start dev server (pnpm dev also works)
npm run build        # Build for production
npm run lint         # Lint Next.js/React
npm run lint:md      # Lint Markdown files
npm test             # Run all unit tests
npm run test:smoke   # Run smoke tests for critical user journeys
```

## Smoke Tests

The `__tests__/smoke/` directory contains automated tests covering the highest-value dashboard journeys:

- **Wallet Connection** — connect, disconnect, loading, and error states
- **Payroll Initiation** — summary cards, proof generation flow
- **Dashboard Status** — history table, status visibility

Run them with `pnpm test:smoke`. CI runs these automatically on every push and PR.

## Areas of Contribution

- **UI Components** — Reusable React components
- **Pages** — New pages and features
- **State Management** — Zustand stores
- **Wallet Integration** — Freighter, other wallets
- **Styling** — Tailwind, accessibility
- **Tests** — Component and E2E tests

## Pull Requests

Before opening a pull request, please review our [Issue Validation Checklist](docs/contributing/ISSUE_VALIDATION_CHECKLIST.md) to ensure your changes are ready for review.

## Issue Labels

| Label | Points |
| ------- | -------- |
| `good-first-issue` | 100 |
| `medium` | 150 |
| `high` | 200 |

## Code Standards

- TypeScript strict mode
- Server components where possible
- Accessible markup
- Mobile responsive

## License

MIT
