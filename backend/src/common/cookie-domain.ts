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
    return explicit.startsWith('.') ? explicit : `.${explicit}`;
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

  return `.${parts.slice(-2).join('.')}`;
}
