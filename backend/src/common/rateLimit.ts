import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './http.js';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function clientKey(request: Request) {
  return request.ip || 'unknown';
}

/** Charge one hit against a fixed window, throwing 429 once the window is spent. */
function consume(key: string, windowMs: number, max: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= max;
}

/** Fixed-window in-memory limiter. Fine for single-instance deploys; use Redis later for multi-replica. */
export function rateLimit({
  windowMs,
  max,
  keyPrefix,
}: {
  windowMs: number;
  max: number;
  keyPrefix: string;
}) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (consume(`${keyPrefix}:${clientKey(request)}`, windowMs, max)) {
      next();
      return;
    }
    next(new ApiError('Too many requests. Try again later.', 429));
  };
}

/**
 * The same window, charged from inside a handler against something more
 * meaningful than the source address — the account acting, or the account being
 * acted on.
 *
 * Middleware can only key on the address, which is the wrong unit twice over.
 * Behind a CDN every visitor arrives from a handful of edge addresses, so one
 * caller's burst throttles strangers. And an attacker with many addresses gets
 * unlimited attempts against a single target, which is what makes a six-digit
 * code guessable: address buckets never see that the guesses share a victim.
 */
export function consumeLimit({
  windowMs,
  max,
  keyPrefix,
  subject,
}: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  subject: string;
}) {
  if (!consume(`${keyPrefix}:${subject}`, windowMs, max)) {
    throw new ApiError('Too many attempts. Try again later.', 429);
  }
}

/**
 * Forget every window. Buckets live for the lifetime of the process, so without
 * this one test's requests spend the next test's allowance — tests share a
 * source address and several share an email.
 */
export function resetRateLimits() {
  buckets.clear();
}

// Opportunistic cleanup so the map cannot grow without bound in long-lived processes.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref?.();
