/** Local default when NEXT_PUBLIC_API_URL is unset outside production builds. */
export const LOCAL_DEV_API_ORIGIN = 'http://localhost:4000';

/**
 * Normalize NEXT_PUBLIC_API_URL to an API origin.
 *
 * Call sites always pass paths that already start with `/api/...`, so the env
 * value must be the host origin only (e.g. `https://api-pi.elpadell.com`).
 * A mistaken trailing `/api` is stripped so CSRF does not become `/api/api/...`.
 */
export function normalizeApiBaseUrl(raw: string | undefined | null): string | null {
  const configured = (raw ?? '').trim().replace(/\/+$/, '');
  if (!configured) return null;
  if (!/^https?:\/\//i.test(configured)) return null;
  return configured.replace(/\/api$/i, '');
}

export type ResolveApiBaseUrlOptions = {
  /** Override for tests. Defaults to `process.env.NODE_ENV`. */
  nodeEnv?: string | undefined;
};

/**
 * Resolve the API origin used by `apiFetch`, Socket.IO, CSP `connect-src`, and OAuth links.
 *
 * - Development / test: falls back to {@link LOCAL_DEV_API_ORIGIN} when unset.
 * - Production: requires a valid `NEXT_PUBLIC_API_URL` at build time (Next inlines
 *   `NEXT_PUBLIC_*`). Missing values used to silently bake in localhost and break
 *   Cloudflare Workers deploys against the Pi API.
 */
export function resolveApiBaseUrl(
  raw: string | undefined | null = process.env.NEXT_PUBLIC_API_URL,
  options: ResolveApiBaseUrlOptions = {},
): string {
  const normalized = normalizeApiBaseUrl(raw);
  if (normalized) return normalized;

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    throw new Error(
      'NEXT_PUBLIC_API_URL must be set at build time to the API origin '
      + '(e.g. https://api-pi.elpadell.com). Do not include a trailing /api — '
      + 'request paths already start with /api/. Set it under Cloudflare Workers '
      + 'Builds → Build variables and secrets, then redeploy.',
    );
  }

  return LOCAL_DEV_API_ORIGIN;
}
