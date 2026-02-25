import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

// ─── CSP ─────────────────────────────────────────────────────────────────────

function buildCsp(): string {
  const isDev = process.env.NODE_ENV === 'development';

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': isDev
      ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
      : ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': [
      "'self'",
      'https://horizon-testnet.stellar.org',
      'https://soroban-testnet.stellar.org',
      'https://horizon.stellar.org',
      'https://soroban-rpc.stellar.org',
    ],
    'worker-src': ["'self'", 'blob:'],
    'child-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  if (typeof WebAssembly !== 'undefined') {
    directives['script-src'].push("'wasm-unsafe-eval'");
  }

  if (!isDev) {
    directives['report-uri'] = ['/api/csp-report'];
  }

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

function applySecurityHeaders(response: NextResponse): void {
  const csp = buildCsp();
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-XSS-Protection', '0');
}

// ─── Route classification ────────────────────────────────────────────────────

const PUBLIC_PATHS = ['/', '/login', '/api/health', '/api/csp-report'];
const PUBLIC_PREFIXES = ['/api/auth/'];
const PROTECTED_PREFIXES = ['/dashboard', '/payroll', '/employees', '/settings'];
const ADMIN_PATHS = ['/payroll/run', '/employees/add'];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_PATHS.some((path) => pathname.startsWith(path));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — security headers only
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    applySecurityHeaders(response);
    return response;
  }

  // Protected routes — verify session
  if (isProtectedRoute(pathname) || (isApiRoute(pathname) && !isPublicRoute(pathname))) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      if (isApiRoute(pathname)) {
        const response = NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
        applySecurityHeaders(response);
        return response;
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      applySecurityHeaders(response);
      return response;
    }

    const session = await verifySessionToken(token);

    if (!session) {
      if (isApiRoute(pathname)) {
        const response = NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
        applySecurityHeaders(response);
        return response;
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      applySecurityHeaders(response);
      return response;
    }

    // Admin route guard
    if (isAdminRoute(pathname) && session.role !== 'admin') {
      if (isApiRoute(pathname)) {
        const response = NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
        applySecurityHeaders(response);
        return response;
      }
      const dashboardUrl = new URL('/dashboard', request.url);
      const response = NextResponse.redirect(dashboardUrl);
      applySecurityHeaders(response);
      return response;
    }
  }

  // Default — pass through with security headers
  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
