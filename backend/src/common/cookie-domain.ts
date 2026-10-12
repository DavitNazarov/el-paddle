/**
 * Hosting platforms where every app is its own site. The last-two-labels
 * rule would call these a shared parent, and browsers reject that cookie.
 */
const MULTI_TENANT_SUFFIXES = new Set([
  'onrender.com',
  'vercel.app',
  'github.io',
  'herokuapp.com',
  'netlify.app',
  'fly.dev',
  'railway.app',
  'pages.dev',
  'azurewebsites.net',
  'cloudfront.net',
]);

/**
 * Resolve the Domain attribute for auth cookies when the API and site
 * sit on sibling hosts (e.g. api.elpadell.com + elpadell.com).
 * Without a shared parent domain, Next.js SSR on the site origin cannot
 * read the session cookie set by the API host.
 */
export function resolveSharedCookieDomain(options: {
  cookieDomain?: string;
  frontendUrls: string[];
  backendUrl: string;
}): string | undefined {
  const explicit = options.cookieDomain?.trim();
  if (explicit) {
    if (explicit.includes('://') || explicit.includes('/')) {
      throw new Error('COOKIE_DOMAIN must be a hostname like .elpadell.com, not a URL.');
    }
    const domain = explicit.startsWith('.') ? explicit : `.${explicit}`;
    if (MULTI_TENANT_SUFFIXES.has(domain.slice(1).toLowerCase())) {
      throw new Error(
        'COOKIE_DOMAIN cannot be a shared hosting suffix such as .onrender.com. Use a domain you control.',
      );
    }
    return domain;
  }

  const hosts = [
    ...options.frontendUrls.map((url) => new URL(url).hostname.toLowerCase()),
    new URL(options.backendUrl).hostname.toLowerCase(),
  ];

  if (new Set(hosts).size <= 1) return undefined;

  const parents = hosts.map(registrableParentDomain);
  if (parents.some((parent) => parent == null)) return undefined;

  const unique = new Set(parents as string[]);
  if (unique.size !== 1) return undefined;

  return unique.values().next().value;
}

function registrableParentDomain(hostname: string): string | null {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;

  const parts = hostname.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  const parent = parts.slice(-2).join('.');
  if (MULTI_TENANT_SUFFIXES.has(parent)) return null;

  return `.${parent}`;
}
