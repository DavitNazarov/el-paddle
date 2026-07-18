import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './http.js';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function clientKey(request: Request) {
  return request.ip || 'unknown';
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
    const now = Date.now();
    const key = `${keyPrefix}:${clientKey(request)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > max) {
      next(new ApiError('Too many requests. Try again later.', 429));
      return;
    }

    next();
  };
}

// Opportunistic cleanup so the map cannot grow without bound in long-lived processes.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref?.();
