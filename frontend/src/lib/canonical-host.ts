/**
 * www of the canonical site host redirects to the apex. Any other host,
 * including a Render default hostname, is left alone so health checks on
 * that hostname still receive the app.
 */
export function wwwToApexRedirect(
  hostHeader: string | null,
  siteUrl: string | undefined,
  pathAndQuery: string,
): string | null {
  if (!hostHeader || !siteUrl || !/^https?:\/\//i.test(siteUrl)) return null;

  let canonical: URL;
  try {
    canonical = new URL(siteUrl);
  } catch {
    return null;
  }

  const host = hostHeader.split(':')[0]?.toLowerCase();
  const canonicalHost = canonical.hostname.toLowerCase();
  if (!host || host !== `www.${canonicalHost}`) return null;

  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return `${canonical.origin}${path}`;
}
