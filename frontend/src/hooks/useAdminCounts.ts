'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AdminCounts } from '@/types/admin';

const emptyCounts: AdminCounts = {
  pending: 0,
  approved: 0,
  declined: 0,
  published: 0,
  drafts: 0,
  events: 0,
  clubs: 0,
  categories: 0,
  applications: 0,
};

export function useAdminCounts() {
  const [counts, setCounts] = useState<AdminCounts>(emptyCounts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await apiFetch('/api/admin/summary', { cache: 'no-store' });
        const data = (await response.json()) as { counts?: AdminCounts };

        if (!cancelled && response.ok) setCounts(data.counts ?? emptyCounts);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { counts, loading };
}
