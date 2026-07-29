import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function jsonError(message: string, status = 400): never {
  throw new ApiError(message, status);
}

export function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function cleanEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

export function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function errorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
}

export function isUniqueConstraintError(error: unknown) {
  if (errorCode(error) === 'P2002') return true;
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('Unique constraint') ||
    error.message.includes('Player already registered for this event') ||
    error.message.includes('duplicate key')
  );
}

export function isNotFoundError(error: unknown) {
  return errorCode(error) === 'P2025';
}

export function isDatabaseConnectionError(error: unknown) {
  const code = errorCode(error);
  if (code === 'P1000' || code === 'P1001' || code === 'P1002' || code === 'ECONNREFUSED') {
    return true;
  }
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('Authentication failed against the database') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('Can’t reach database server') ||
    error.message.includes("Can't reach database server")
  );
}

export function databaseUnavailableMessage() {
  return 'Database is not ready. Start Postgres with `docker compose up -d postgres`, run `npm run prisma:migrate`, then restart the backend.';
}

function safeServerMessage(error: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return 'Unexpected server error.';
  }
  if (!(error instanceof Error)) return 'Unexpected server error.';
  if (
    error.message.includes('Prisma') ||
    error.message.includes('adapter') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.length > 220
  ) {
    return 'A server dependency is not ready. Check database and environment settings.';
  }
  return error.message;
}

export function requireParamId(value: unknown, label = 'id') {
  const id = cleanString(value);
  if (!id || id.length > 128) jsonError(`Invalid ${label}.`, 400);
  return id;
}

export function isSafeHttpUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function handleError(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  if (isNotFoundError(error)) {
    response.status(404).json({ error: 'Resource not found.' });
    return;
  }

  if (isDatabaseConnectionError(error)) {
    console.error('[api:database]', error);
    response.status(503).json({ error: databaseUnavailableMessage() });
    return;
  }

  console.error('[api]', error);
  response.status(500).json({ error: safeServerMessage(error) });
}

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

/**
 * Mark an anonymous, publication-gated GET as cacheable (F5). A short max-age
 * keeps newly (un)published data fresh within a minute; stale-while-revalidate
 * lets a shared cache serve instantly while it refreshes in the background. CORS
 * already emits `Vary: Origin`, so per-origin caching is correct. Never call this
 * on authenticated or user-specific responses. Call it only on the success path
 * so errors and database-unavailable fallbacks are never cached.
 */
export function setPublicCache(
  response: Response,
  { maxAge = 60, staleWhileRevalidate = 300 }: { maxAge?: number; staleWhileRevalidate?: number } = {},
) {
  response.setHeader(
    'Cache-Control',
    `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  );
}
