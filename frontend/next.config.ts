import type { NextConfig } from 'next';

function resolvePublicApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
  if (!configured || !/^https?:\/\//i.test(configured)) {
    return 'http://localhost:4000';
  }
  return configured;
}

const apiUrl = resolvePublicApiUrl();

function websocketOrigin(value: string) {
  try {
    const url = new URL(value);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.origin;
  } catch {
    return '';
  }
}

const connectSources = ["'self'", apiUrl, websocketOrigin(apiUrl)].filter(Boolean).join(' ');
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `connect-src ${connectSources}`,
  "worker-src 'self' blob:",
].join('; ');

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

const nextConfig: NextConfig = {
  output: 'standalone',
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
        // All app routes except sitemap/robots metadata files.
        source: '/((?!sitemap\\.xml$|robots\\.txt$).*)',
        headers: [
          ...securityHeadersWithoutCsp,
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
