'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { ClubOptionDto } from '@/types/admin';

export function useClubOptions() {
  const [clubs, setClubs] = useState<ClubOptionDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await apiFetch('/api/public/clubs', { cache: 'no-store' });
          const data = (await response.json()) as { clubs?: ClubOptionDto[] };
          setClubs(data.clubs ?? []);
        } catch {
          setClubs([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return { clubs, loading };
}
