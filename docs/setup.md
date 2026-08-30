# Contributor Setup Guide

Quick, contributor-facing setup notes for the ZK Payroll Dashboard. Covers required environment variables, local run commands, and common install problems with fixes. Privacy-first: never log raw salary values or commitments.

> Full walkthrough with wallet funding & validation checklists: see [SETUP_GUIDE.md](./SETUP_GUIDE.md). This file is the short, copy-paste-friendly reference contributors need to ship UI fixes without getting stuck at install time.

## 📋 Prerequisites

| Tool | Version | Purpose |
| ------ | --------- | --------- |
| Node.js | 18+ (20 LTS recommended) | Run Next.js app & scripts |
| npm | 10+ (ships with Node 18) | Install deps — repo uses `package-lock.json` |
| pnpm | 8+ *optional* | Alternative; if used, run `pnpm install` and `pnpm dev` (see lockfile note below) |
| Freighter | Chrome / Firefox extension | Stellar wallet for testnet |
| Git | Latest | Version control |

Check versions:

```bash
node -v      # expect v18+ or v20+
npm -v       # expect 10+
git --version
```

## 🔧 Environment Variables

Copy the example and fill in secrets locally. Never commit `.env.local`.

```bash
cp .env.example .env.local
```

| Variable | Required | Example | Purpose / Notes |
| ---------- | ---------- | --------- | ----------------- |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Yes | `TESTNET` | Stellar network selector. Use `TESTNET` for local dev; `PUBLIC` only for mainnet deploys. |
| `NEXT_PUBLIC_HORIZON_URL` | Yes | `https://horizon-testnet.stellar.org` | Horizon API endpoint for account & transaction queries. Must match `STELLAR_NETWORK`. |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Yes | `https://soroban-testnet.stellar.org` | Soroban RPC for contract calls (registry, commitment, verifier, executor, audit). Must match network. |
| `SESSION_SECRET` | Yes | `your-secret-key-at-least-32-characters-long` | Server-side session encryption key. **Minimum 32 chars**, random. Generate with `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Invalid/short values throw on boot — see `lib/env.ts`. |
| `ADMIN_PUBLIC_KEY` | Yes | `G...56 chars` | Stellar public key (starts with `G`, 56 chars) of the company admin. Used for permission checks and `ADMIN_PUBLIC_KEY` validation in `lib/env.ts`. Copy from Freighter → Copy Address after funding via Friendbot (see [SETUP_GUIDE.md](./SETUP_GUIDE.md#fund-your-testnet-account)). |

Default `.env.example` already points to Testnet. Only `SESSION_SECRET` and `ADMIN_PUBLIC_KEY` must be replaced per contributor.

**Where these are validated:** `lib/env.ts` uses `zod` to validate on startup; missing/invalid vars log a redacted error (no secrets echoed) and throw.

## 🚀 Local Run Commands

All commands from repo root. Prefer `npm` (lockfile is `package-lock.json`). If you use `pnpm`, replace `npm` with `pnpm` — see lockfile note below.

```bash
# 1. Install dependencies
npm install          # or: pnpm install (if you prefer pnpm; see note)
# If you see peer-deps warnings, they are typically safe to ignore. For clean reinstall:
rm -rf node_modules package-lock.json && npm install

# 2. Configure environment (see table above)
cp .env.example .env.local
# then edit .env.local with your SESSION_SECRET and ADMIN_PUBLIC_KEY

# 3. Run the dev server (http://localhost:3000)
npm run dev          # or: pnpm dev
npm run dev -- -p 3001   # alternate port if 3000 is busy

# 4. Production build & start
npm run build        # Next.js build + typecheck
npm start            # serve production build on 3000

# 5. Tests
npm test             # all unit tests (vitest run)
npm run test:smoke   # critical journeys: wallet, payroll, history
npm run test:watch   # watch mode
npm run test:coverage

# 6. Lint & typecheck
npm run lint         # Next.js / ESLint
npm run lint:md      # markdownlint
npm run lint:md:fix  # auto-fix markdown
npm run typecheck    # tsc --noEmit
```

> **Privacy note:** tests and build logs never emit salary amounts or raw commitments — only asset codes, commitment hashes, and redacted counts (see `lib/privacy/`, `lib/logger.ts`).

## 🐛 Common Install Problems & Fixes

| Problem | Symptoms | Fix |
| --------- | ---------- | ----- |
| **Node version too old** | `EBADENGINE`, `Unexpected token`, build fails | Install Node 18+ or 20 LTS: `nvm install 20 && nvm use 20`, then `rm -rf node_modules && npm install`. Verify with `node -v`. |
| **Lockfile mismatch (npm vs pnpm)** | `pnpm install` creates `pnpm-lock.yaml`, CI expects `package-lock.json`; or `npm install` warns about `pnpm` | This repo commits `package-lock.json`. Prefer `npm install`. If you use `pnpm`, delete the other lockfile before committing (`rm pnpm-lock.yaml` or `rm package-lock.json`) and run the matching install. Do not commit both. |
| **Missing `.env.local`** | `Invalid environment variables` on `npm run dev`, app crashes at import of `lib/env.ts` | `cp .env.example .env.local` and fill `SESSION_SECRET` (≥32 chars) and `ADMIN_PUBLIC_KEY` (`G...`). Restart dev server. |
| **`SESSION_SECRET` too short** | Zod error: `SESSION_SECRET: String must contain at least 32 character(s)` | Generate a new secret: `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste into `.env.local`. |
| **Port 3000 already in use** | `Port 3000 is in use` or `EADDRINUSE` | Kill process on 3000 (`lsof -ti:3000`) then `npm run dev`, or `npm run dev -- -p 3001`. |
| **Freighter not detected** | Dashboard shows “Freighter not detected”, Connect button does nothing | Install Freighter extension, unlock it, refresh page, set network to **Testnet** (Settings → Network). |
| **Horizon / Soroban RPC errors** | `Horizon request failed`, `Soroban RPC error`, empty balances | Verify `.env.local` URLs match `NEXT_PUBLIC_STELLAR_NETWORK`. Testnet defaults shown above. Check network connectivity and that you are not pointing Testnet wallet at Public Horizon. |
| **Funded account still shows 0 XLM** | Friendbot succeeded but Freighter balance 0 | Ensure Freighter is on **Testnet** before funding. Re-fund with `curl "https://friendbot.stellar.org?addr=YOUR_G_ADDRESS"` and check `https://testnet.stellarexpert.com`. |
| **ESLint / markdownlint failures in CI** | `npm run lint` or `npm run lint:md` fails after editing docs | Run `npm run lint:md:fix` for markdown, and `npm run lint` locally before pushing. Do not skip hooks. |

## ✅ Quick QA Checks

- **Success:** `npm install` completes without `EBADENGINE`; `cp .env.example .env.local` with valid 32+ char secret and `G...` admin key; `npm run dev` serves on `http://localhost:3000`; `npm test` and `npm run test:smoke` pass; wallet connects on Testnet.
- **Failure:** Remove `SESSION_SECRET` from `.env.local` and run `npm run dev` — expect `Invalid environment variables` error without leaking the secret. Set `ADMIN_PUBLIC_KEY=invalid` — expect zod validation error.
- **Edge:** Set `SESSION_SECRET` to exactly 32 chars (e.g. `a`×32) — app boots but you should replace with a random value. Use Node 18.0.0 vs 20 LTS — both should build, but 20 LTS is recommended for CI parity.

## 📚 Where to go next

- Full guide: [SETUP_GUIDE.md](./SETUP_GUIDE.md) — wallet install, Friendbot, validation checklist, operator docs.
- Admin / recovery: [ADMIN_RECOVERY_GUIDE.md](./ADMIN_RECOVERY_GUIDE.md), [WALLET_SIGNING_RECOVERY_GUIDE.md](./WALLET_SIGNING_RECOVERY_GUIDE.md).
- Issues & PRs: see [CONTRIBUTING.md](../CONTRIBUTING.md) and [docs/contributing/ISSUE_VALIDATION_CHECKLIST.md](./contributing/ISSUE_VALIDATION_CHECKLIST.md).
