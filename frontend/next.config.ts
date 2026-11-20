import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { normalizeApiBaseUrl } from './src/lib/api/base-url';

// NEXT_PUBLIC_API_URL is inlined at build time. Fail production builds early when
// it is missing so Cloudflare Workers never ship the localhost CSRF fallback.
if (process.env.NODE_ENV === 'production' && !normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)) {
  throw new Error(
    'NEXT_PUBLIC_API_URL must be set for production builds '
    + '(e.g. https://api-pi.elpadell.com). Configure it under Cloudflare Workers '
    + 'Builds → Build variables and secrets, then redeploy.',
  );
}

// The Content-Security-Policy is built per request in `src/middleware.ts`: it
// carries a fresh nonce, which a static header cannot. Everything below is the
// part of the security header set that is the same on every response.
const securityHeadersWithoutCsp = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
];

// OpenNext on Cloudflare does not use `output: 'standalone'`. Keep it only for
// the Docker image path (frontend/Dockerfile) via DOCKER_BUILD=1.
const nextConfig: NextConfig = {
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
  poweredByHeader: false,
  async headers() {
    return [
      // Metadata responses must not inherit page CSP. Chrome's XML pretty-printer
      // injects inline styles; CSP makes /sitemap.xml render as raw text and can
      // confuse crawlers that expect a clean application/xml document.
      {
        source: '/sitemap.xml',
        headers: [
          ...securityHeadersWithoutCsp,
          { key: 'Content-Type', value: 'application/xml; charset=utf-8' },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          ...securityHeadersWithoutCsp,
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
        ],
      },
      {
        // All app routes except sitemap/robots metadata files. CSP is added on
        // top of these by the middleware, which owns the per-request nonce.
        source: '/((?!sitemap\\.xml$|robots\\.txt$).*)',
        headers: securityHeadersWithoutCsp,
      },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
