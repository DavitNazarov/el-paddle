import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/env.js';

export const CSRF_COOKIE = 'elpadel_csrf';

export function issueCsrfToken(_request: Request, response: Response) {
  const token = crypto.randomBytes(32).toString('base64url');
  const cookieOptions = {
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: config.isProduction,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  };
  if (config.cookieDomain) {
    response.clearCookie(CSRF_COOKIE, {
      httpOnly: false,
      sameSite: 'lax',
      secure: config.isProduction,
      path: '/',
    });
  }
  response.cookie(CSRF_COOKIE, token, cookieOptions);
  response.json({ token });
}

/**
 * The origin an unsafe request came from, taken from `Origin` and falling back
 * to `Referer` for the rare client that omits it. Neither can be set from
 * script across sites, so this is the check that actually stops a forged
 * request. The double-submit token below cannot carry that weight on its own:
 * `elpadel_csrf` is readable and writable by every host under the shared cookie
 * domain, so anything with a foothold on a sibling subdomain controls both
 * halves of the comparison.
 */
function requestOrigin(request: Request) {
  const origin = request.headers.origin;
  if (typeof origin === 'string' && origin) return origin;
  const referer = request.headers.referer;
  if (typeof referer !== 'string' || !referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function csrfGuard(request: Request, response: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  const cookie = request.cookies?.[CSRF_COOKIE];
  const header = request.headers['x-csrf-token'];
  // Required, not merely validated when present: a request that declares no
  // origin at all used to skip this branch entirely.
  if (!config.isAllowedFrontendOrigin(requestOrigin(request))) {
    response.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  if (typeof cookie !== 'string' || typeof header !== 'string' || cookie.length < 32 || cookie.length !== header.length || !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
    response.status(403).json({ error: 'Invalid CSRF token. Refresh and try again.' });
    return;
  }
  next();
}

