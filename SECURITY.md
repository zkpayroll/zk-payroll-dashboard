# Security Headers Policy

This document explains the security headers and Content Security Policy (CSP) configured in `middleware.ts`.

## Security Headers

| Header | Value | Rationale |
|--------|-------|-----------|
| `Content-Security-Policy` | See CSP section below | Primary defense against XSS and injection attacks |
| `X-Frame-Options` | `DENY` | Prevents clickjacking by blocking all iframe embedding |
| `X-Content-Type-Options` | `nosniff` | Prevents browsers from MIME-sniffing responses away from declared content type |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage — sends full URL for same-origin, only origin for cross-origin HTTPS |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables unnecessary browser APIs that this application does not use |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS for 1 year, including subdomains |
| `X-XSS-Protection` | `0` | Disables legacy XSS auditor — CSP is the modern replacement, and the auditor can introduce vulnerabilities |

## Content Security Policy Directives

| Directive | Value | Rationale |
|-----------|-------|-----------|
| `default-src` | `'self'` | Fallback — only allow resources from the application origin |
| `script-src` | `'self' 'wasm-unsafe-eval'` | Allow own scripts and WASM execution for ZK proof generation (snarkjs, noir). In development, `'unsafe-eval'` is added for Next.js hot module replacement |
| `style-src` | `'self' 'unsafe-inline'` | `'unsafe-inline'` is required because Tailwind CSS and many UI libraries inject inline styles |
| `img-src` | `'self' data: blob:` | Allow images from own origin, data URIs (icons/SVGs), and blob URLs |
| `font-src` | `'self'` | Only allow fonts from own origin |
| `connect-src` | `'self'` + Stellar endpoints | Allow XHR/fetch to own origin and the Stellar Horizon/Soroban RPC endpoints (both testnet and mainnet) |
| `worker-src` | `'self' blob:` | Allow web workers from own origin and blob URLs (used by WASM-based proof generation) |
| `child-src` | `'self' blob:` | Allow child contexts (workers/frames) from own origin and blob URLs |
| `object-src` | `'none'` | Block all plugins (Flash, Java, etc.) — not needed |
| `base-uri` | `'self'` | Prevent `<base>` tag injection that could redirect relative URLs |
| `form-action` | `'self'` | Restrict form submissions to own origin only |
| `frame-ancestors` | `'none'` | CSP equivalent of `X-Frame-Options: DENY` — prevents any site from embedding this app |
| `report-uri` | `/api/csp-report` | Production only — sends violation reports to our logging endpoint |

## Environment Differences

- **Development**: `script-src` includes `'unsafe-eval'` to allow Next.js hot module replacement and React Fast Refresh. `report-uri` is omitted to reduce noise.
- **Production**: Strict CSP without `'unsafe-eval'`. Violations are reported to `/api/csp-report`.

## CSP Reporting

Policy violations are sent to `POST /api/csp-report` in production. Reports are logged to `console.warn` and can be forwarded to an external monitoring service in the future.

## Wallet Extension Compatibility

The Freighter wallet extension injects scripts into the page. The current CSP does not explicitly allowlist extension scripts because browser extensions operate outside CSP scope — they use `chrome-extension://` protocol which is not restricted by page-level CSP.
