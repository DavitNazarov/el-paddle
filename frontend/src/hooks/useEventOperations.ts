'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { EventOperationsDto } from '@/types/admin';

/**
 * Operational counts for every event the viewer runs, keyed by event id. One
 * grouped read backs the whole board, so adding an event to the season does not
 * add a request to the page.
 */
export function useEventOperations() {
  const [operations, setOperations] = useState<Map<string, EventOperationsDto>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await apiFetch('/api/admin/events/operations', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { operations?: EventOperationsDto[] };
        if (cancelled) return;
        setOperations(new Map((data.operations ?? []).map((row) => [row.eventId, row])));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { operations, loading };
}
