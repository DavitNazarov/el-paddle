'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { PlatformStats, StatsRange } from '@/types/adminStats';

/**
 * Platform statistics for the administrator home screen.
 *
 * Follows the house shape — one effect, a `cancelled` flag, `no-store`, and no
 * error state — with one deliberate divergence: `stats` stays `null` until it has
 * actually loaded, and stays `null` if the read fails. A count that has not
 * arrived must render as a skeleton, never as `0`; `null` means "not known" and
 * `0` means "none", and a statistics screen that confuses the two is lying.
 *
 * (`useAdminCounts` still seeds zeros. Left alone here on purpose: the admin
 * shell's sidebar reads that shape. Worth fixing separately.)
 */
export function useAdminStats(initialRange: StatsRange = '30d') {
  const [range, setRange] = useState<StatsRange>(initialRange);
  // The range each payload belongs to is stored with it, so `loading` is derived
  // rather than set — a `setLoading(true)` in the effect body would trigger a
  // cascading render on every range change.
  const [loaded, setLoaded] = useState<{ range: StatsRange; stats: PlatformStats | null } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let stats: PlatformStats | null = null;
      try {
        const response = await apiFetch(`/api/admin/stats/platform?range=${range}`, {
          cache: 'no-store',
        });
        if (response.ok) {
          const data = (await response.json()) as { stats?: PlatformStats };
          stats = data.stats ?? null;
        }
      } catch {
        // A refused or failed read is a missing number, not an error banner.
      }
      // Recorded even when the read failed, so the screen can stop waiting and
      // say it has nothing.
      if (!cancelled) setLoaded({ range, stats });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  // While a different range is in flight the previous numbers are withheld:
  // showing last month's figures under a "last 7 days" heading would be a lie.
  const current = loaded && loaded.range === range ? loaded : null;

  return { stats: current?.stats ?? null, loading: current === null, range, setRange };
}
