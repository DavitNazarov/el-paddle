import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/env.js';

export const CSRF_COOKIE = 'elpadel_csrf';

export function issueCsrfToken(_request: Request, response: Response) {
  const token = crypto.randomBytes(32).toString('base64url');
  response.cookie(CSRF_COOKIE, token, { httpOnly: false, sameSite: 'lax', secure: config.isProduction, path: '/', maxAge: 24 * 60 * 60 * 1000 });
  response.json({ token });
}

export function csrfGuard(request: Request, response: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  const cookie = request.cookies?.[CSRF_COOKIE];
  const header = request.headers['x-csrf-token'];
  const origin = request.headers.origin;
  if (origin && !config.isAllowedFrontendOrigin(origin)) {
    response.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  if (typeof cookie !== 'string' || typeof header !== 'string' || cookie.length < 32 || cookie.length !== header.length || !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
    response.status(403).json({ error: 'Invalid CSRF token. Refresh and try again.' });
    return;
  }
  next();
}

