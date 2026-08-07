import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request Content-Security-Policy.
 *
 * The policy used to carry `script-src 'self' 'unsafe-inline'`, which makes the
 * script directive inert as an XSS control: any injected inline script runs. A
 * nonce cannot be guessed by injected markup, so only the scripts this render
 * emitted execute, and `'strict-dynamic'` lets those load the application's own
 * chunks without an origin allow-list.
 *
 * This has to be a per-request header rather than a static one in
 * `next.config.ts`, because a nonce is only sound when it is fresh. That is safe
 * here because every app route renders on demand — the `revalidate` values in
 * this app sit on `fetch` calls (the data cache), not on route segments, so no
 * HTML is ever replayed from cache with a spent nonce.
 */
function resolveApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
  return /^https?:\/\//i.test(configured) ? configured : 'http://localhost:4000';
}

function websocketOrigin(value: string) {
  try {
    const url = new URL(value);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.origin;
  } catch {
    return '';
  }
}

const apiUrl = resolveApiUrl();
const connectSources = ["'self'", apiUrl, websocketOrigin(apiUrl)].filter(Boolean).join(' ');

// React's development build uses eval() for hot reload and callstack
// reconstruction. Production builds never do, so the relaxation stays in dev.
const isDevelopment = process.env.NODE_ENV !== 'production';

function contentSecurityPolicy(nonce: string) {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ].join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Inline styles stay allowed: Next and the CSS layer inject them, and style
    // injection is not a script-execution vector.
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSources}`,
    `connect-src ${connectSources}`,
    "worker-src 'self' blob:",
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = contentSecurityPolicy(nonce);

  // Next reads the policy off the *request* headers to stamp the same nonce on
  // the scripts it emits, so it has to be set on both sides of the hop.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', policy);
  return response;
}

export const config = {
  matcher: [
    /*
     * Every rendered route. Static assets carry no inline script and need no
     * policy; the metadata files deliberately ship without CSP so Chrome's XML
     * pretty-printer can style /sitemap.xml (see next.config.ts).
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
