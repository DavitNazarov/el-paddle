import type { StatsRange } from './statsModel.js';

/**
 * A tiny in-process cache for the platform statistics payload.
 *
 * Safe on an authenticated response because the cached value is byte-identical
 * for every caller who can reach it: only holders of a global `DASHBOARD_READ`
 * get past the guard, organisers are refused before the service runs, and the
 * payload holds no per-user data. There is no tenant to leak across.
 *
 * No invalidation story is needed — nothing writes to it, the numbers are
 * bucket-grained, and a value up to a minute old is stale rather than wrong. The
 * payload carries `generatedAt` so the screen can say "as of 14:32" instead of
 * pretending to be live. HTTP caching is deliberately not used here;
 * `setPublicCache` forbids itself on authenticated responses.
 *
 * NOTE for tests: `resetDb()` truncates tables but cannot clear this Map, so an
 * integration test that does not call `resetStatsCache()` in `beforeEach` will
 * read another test's numbers.
 */

const TTL_MS = 60_000;

type Entry<T> = { expiresAt: number; value: T };

const entries = new Map<StatsRange, Entry<unknown>>();

export function readStatsCache<T>(range: StatsRange, now = Date.now()): T | undefined {
  const entry = entries.get(range);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    entries.delete(range);
    return undefined;
  }
  return entry.value as T;
}

export function writeStatsCache<T>(range: StatsRange, value: T, now = Date.now()) {
  entries.set(range, { expiresAt: now + TTL_MS, value });
  return value;
}

export function resetStatsCache() {
  entries.clear();
}
