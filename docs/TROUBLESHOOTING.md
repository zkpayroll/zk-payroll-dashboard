# Troubleshooting Guide

Common failures contributors and integrators hit when setting up, building, testing, or deploying the ZK Payroll Dashboard.

---

## Table of Contents

- [Environment Configuration](#environment-configuration)
- [Dependency & Package Manager Issues](#dependency--package-manager-issues)
- [Build Failures](#build-failures)
- [Test Failures](#test-failures)
- [CI Failures](#ci-failures)
- [Runtime Issues](#runtime-issues)
- [Docker Issues](#docker-issues)
- [Common Error Messages](#common-error-messages)

---

## Environment Configuration

### "SESSION_SECRET must be at least 32 characters"

**Where**: `lib/env.ts` and `lib/auth/session.ts` both enforce this at startup.

**Fix**: Generate a random 32+ character string:

```bash
openssl rand -base64 32
```

Update `SESSION_SECRET` in `.env.local`.

### "Invalid environment variables" on startup

**Where**: `lib/env.ts` — Zod schema validates these at import time:

```
NEXT_PUBLIC_STELLAR_NETWORK   must be "TESTNET" or "PUBLIC"
NEXT_PUBLIC_HORIZON_URL       must be a valid URL
NEXT_PUBLIC_SOROBAN_RPC_URL   must be a valid URL
SESSION_SECRET                must be >= 32 characters
ADMIN_PUBLIC_KEY              must not be empty
```

**Fix**: Copy `.env.example` to `.env.local`, fill every variable.

```bash
cp .env.example .env.local
```

Then edit `.env.local` with real values.

### `ADMIN_PUBLIC_KEY` is set but I still get `employee` role

Role resolution checks env vars in this order:

1. `ADMIN_PUBLIC_KEY` — exact match → `admin`
2. `OPERATOR_PUBLIC_KEYS` — comma-separated, trimmed → `operator`
3. `AUDITOR_PUBLIC_KEYS` — comma-separated, trimmed → `auditor`
4. Otherwise → `employee`

**Fix**: Ensure `ADMIN_PUBLIC_KEY` matches **exactly** the Stellar public key your Freighter wallet uses. Keys are case-sensitive and must match exactly including any whitespace.

### `NODE_ENV`-dependent behavior differences

| Behavior | Development | Production |
|---|---|---|
| CSP `script-src` | includes `'unsafe-eval'` | strict |
| CSP `report-uri` | omitted | `/api/csp-report` |
| API auth middleware | accepts any Bearer token | validates token |
| Stellar debug panel | visible | hidden |

If unexpected CSP violations appear in production, check that `NODE_ENV` is set correctly.

---

## Dependency & Package Manager Issues

### The project uses `npm`, not `pnpm` or `yarn`

**Problem**: `CONTRIBUTING.md` references `pnpm`, but the committed lockfile is `package-lock.json` (npm v3). Using `pnpm install` or `yarn` produces a different tree and may cause CI failures.

**Fix**: Always use `npm`:

```bash
# Remove any other lockfiles
rm -f pnpm-lock.yaml yarn.lock

# Install with npm
npm install
```

### Lockfile conflicts after rebase or merge

**Problem**: CI step `npm ci` fails with "The lockfile is not up to date."

**Fix**: Regenerate and commit the lockfile:

```bash
rm -rf node_modules
npm install
git add package-lock.json
```

### Missing `@testing-library/user-event`

**Problem**: Tests fail with "Failed to resolve import `@testing-library/user-event`."

**Cause**: The package is not listed in `devDependencies` but some test files import it.

**Fix**:

```bash
npm install --save-dev @testing-library/user-event
```

### Node.js version mismatch

| Environment | Required Version |
|---|---|
| Local development | 18+ |
| CI (GitHub Actions) | 20 |
| Docker | 18 (Alpine) |

**Problem**: Locally the app starts; CI fails with obscure syntax errors.

**Fix**: Use the same major version locally. Recommended: Node 20 (matches CI).

```bash
# If using nvm
nvm install 20
nvm use 20
```

The project has no `.nvmrc`. Consider creating one:

```
20
```

### WASM / ZK artifact dependencies

ZK proof artifacts (`*.wasm`, `verification_key.json`) are gitignored under `public/`.

**Problem**: Build fails because WASM files are missing.

**Fix**: The engine falls back to a mock prover automatically. No action needed unless you need real proofs. For local testing the mock is sufficient.

---

## Build Failures

### `npm run build` fails with TypeScript errors

**Problem**: CI step `npx tsc --noEmit` passes, but `next build` fails.

**Common causes**:
- A `.ts` file imports a `.tsx` component without the `.js` extension (Next.js bundler expects extensions in some edge cases)
- A `"use client"` component uses server-only APIs
- `next.config.mjs` syntax error

**Diagnose**:

```bash
npm run typecheck   # TypeScript-only check (faster)
npm run build       # Full Next.js build
```

Compare output. The `typecheck` step in CI is a good place to start.

### "Module not found: Can't resolve `@/...`"

**Fix**: The `@` alias maps to the project root (`tsconfig.json` → `paths: { "@/*": ["./*"] }`). Verify the import path relative to the project root. This works in both Next.js and Vitest.

### WASM webpack errors

**Problem**: `asyncWebAssembly` errors during build.

**Fix**: Check `next.config.mjs` — the webpack configuration enables `asyncWebAssembly: true` and adds a rule for `.wasm` files. If you add another webpack plugin, it may conflict.

---

## Test Failures

### Smoke tests fail in CI but pass locally

**Possible causes**:

| Cause | Check |
|---|---|
| Node version differs | CI uses Node 20; check your local version |
| Missing env variables | CI sets `NEXT_PUBLIC_*` vars; your `.env.local` may differ |
| Lockfile stale | `npm ci` fails → check `package-lock.json` is committed |

Run the exact CI commands locally:

```bash
rm -rf node_modules
npm ci
npm run lint
npx tsc --noEmit
npm run test:smoke
```

### "Unable to find an element with the text" in component tests

**Possible causes**:
- The component is role-gated and the test doesn't set a role in the auth store mock
- The component renders conditionally based on wallet state not being set

**Fix**: Mock `useAuthStore` with the expected role:

```ts
vi.mocked(useAuthStore).mockImplementation((selector?: any) => {
  const state = { role: "admin" as const, ... };
  return typeof selector === "function" ? selector(state) : state;
});
```

### "Cannot find module `@testing-library/dom`"

The package was installed but didn't get resolved. This can happen if `node_modules` is corrupted.

```bash
rm -rf node_modules package-lock.json
npm install
```

### Test file fails to load (suite failure)

Check the test file for:
- Importing a component that has a compilation error (check that component separately)
- Missing `@testing-library/user-event` import
- Incorrect mocking of a module that doesn't exist

---

## CI Failures

### Reproduce any CI step locally

CI runs these steps in order:

```bash
npm ci                    # Clean install (fails if lockfile is stale)
npm run lint              # ESLint
npx tsc --noEmit         # TypeScript check
npm test                  # Unit tests
npm run test:smoke       # Smoke tests
npm run build            # Next.js production build
```

Run them sequentially to find the exact failing step.

### "npm ci" fails — lockfile mismatch

**Problem**: `package-lock.json` was modified locally (or not committed after `npm install`).

**Fix**:

```bash
npm install     # Regenerates lockfile
git add package-lock.json
git commit -m "chore: update lockfile"
```

### "npm run build" fails with missing env in CI

CI does not automatically populate `.env.local`. The `next build` step in `.github/workflows/ci.yml` only sets `NEXT_TELEMETRY_DISABLED`.

**Fix**: The build should not require runtime env vars at build time. If it does, add required vars to the build step in `ci.yml`:

```yaml
- name: Build Next.js
  run: npm run build
  env:
    NEXT_TELEMETRY_DISABLED: 1
    NEXT_PUBLIC_STELLAR_NETWORK: TESTNET
    # ... other vars needed at build time
```

### Deployment workflow fails

The `.github/workflows/deploy.yml` requires `VERCEL_TOKEN` in GitHub secrets.

**Check**:
- `VERCEL_TOKEN` is set in the repository's **Settings → Secrets and variables → Actions**
- The Vercel project is linked correctly
- The `vercel` CLI is authenticated

---

## Runtime Issues

### Wallet keeps asking to connect on every page load

**Cause**: The session cookie expired (24-hour TTL) or was cleared.

**Fix**: Log in again via the `/login` page. If the problem persists, check that `SESSION_SECRET` is consistent across deployments (changing it invalidates all sessions).

### "Forbidden" on a page I should have access to

The middleware checks `canAccessRoute(pathname, role)`. Check the route's permission:

| Route | Allowed Roles |
|---|---|
| `/` | all |
| `/employees` | admin, operator |
| `/payroll/execute` | admin, operator |
| `/history` | admin, operator, auditor |
| `/treasury` | admin, operator, auditor |
| `/compliance` | admin, auditor |
| `/setup`, `/admin`, `/employees/add`, `/payroll/run` | admin only |
| `/settings` | all |

If your role should allow the route:
1. Verify your session role: check the `zk-payroll-role` cookie in DevTools
2. Verify the env var assignment: your public key must match `ADMIN_PUBLIC_KEY`, `OPERATOR_PUBLIC_KEYS`, or `AUDITOR_PUBLIC_KEYS`

### API routes return 401 despite being logged in

The API routes use `lib/api/middleware.ts` which checks the `Authorization` header (Bearer token), **not** the session cookie. This is a separate auth path.

- In **development**: any Bearer token is accepted (stub).
- In **production**: requires a valid token from your auth provider (currently a stub — see TODO in `lib/api/middleware.ts`).

### CSP blocks a resource

The Content-Security-Policy is set in `middleware.ts`. To debug:

1. Check the browser console for CSP violation reports
2. In development, `script-src` includes `'unsafe-eval'` and `'unsafe-inline'`
3. In production, reports are sent to `/api/csp-report`
4. Freighter wallet operates outside CSP scope (`chrome-extension://` protocol) — no action needed

### Network wrong / transactions fail

The wallet's network must match `NEXT_PUBLIC_STELLAR_NETWORK`:

| `.env` value | Freighter setting | Horizon URL |
|---|---|---|
| `TESTNET` | Testnet | `https://horizon-testnet.stellar.org` |
| `PUBLIC` | Public | `https://horizon.stellar.org` |

Check the network indicator in the dashboard header or browser console logs.

---

## Docker Issues

### Docker build fails

The Dockerfile uses `node:18-alpine`. If you need a newer Node, update both the Dockerfile and the CI workflow.

```dockerfile
FROM node:20-alpine AS deps
```

### Docker compose stellar container won't start

The `stellar/quickstart` image pulls Soroban + Horizon. It can take several minutes on first run.

```bash
# Check logs
docker compose logs stellar

# Expected: "Starting Horizon on port 8000"
# If stuck, try pulling the latest image
docker compose pull stellar
```

### Port conflicts

| Service | Default Port |
|---|---|
| App | 3000 |
| Horizon (Stellar) | 8000 |
| Soroban RPC | 8001 |

```bash
# Change app port
docker compose run -p 3001:3000 app
```

### Bind mount issues

The `docker-compose.yml` mounts `node_modules` and `.next` as anonymous volumes. If dependencies change, rebuild:

```bash
docker compose build --no-cache app
```

---

## Common Error Messages

| Error Message | Likely Cause | Quick Fix |
|---|---|---|
| `SESSION_SECRET must be at least 32 characters` | Missing or short `SESSION_SECRET` in `.env` | Generate a 32-char secret |
| `Invalid environment variables` | Missing or invalid env var | Run `cp .env.example .env.local` and fill values |
| `Cannot find module '@testing-library/user-event'` | Missing dev dependency | `npm install --save-dev @testing-library/user-event` |
| `Failed to resolve import` in tests | Missing package or incorrect mock | Check `package.json` for the dependency |
| `The lockfile is not up to date` | `package-lock.json` stale after merge | `npm install && git add package-lock.json` |
| `Module not found: Can't resolve '@/...'` | Incorrect import path | Verify path relative to project root |
| `Unable to find an element with the text` | Component role-gated or state-dependent | Mock `useAuthStore` with the correct role |
| `Forbidden` on a page | Your role doesn't have access | Check route permissions table |
| `401 Unauthorized` on API route | Missing or invalid Bearer token | API uses `Authorization` header, not session cookie |
| `Port 3000 already in use` | Another process on the port | `lsof -ti:3000 \| xargs kill -9` or use `-p 3001` |
| `Freighter not detected` | Wallet extension not installed/unlocked | See [SETUP_GUIDE.md](./SETUP_GUIDE.md) |
| `wasm-unsafe-eval` CSP error | CSP blocks WASM (should not happen with current config) | Check `middleware.ts` CSP builder |

---

## Related Documentation

| Guide | Topics |
|---|---|
| [Setup Guide](./SETUP_GUIDE.md) | First-time environment setup, wallet funding, validation checklist |
| [Admin Recovery Guide](./ADMIN_RECOVERY_GUIDE.md) | Wallet, network, funding, and proof generation recovery |
| [Contributing](../CONTRIBUTING.md) | Development workflow, code standards, issue labels |
| [CI Workflow](../.github/workflows/ci.yml) | Exact commands CI runs on every push |
