'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { PublicUser } from '@/types/auth';

/**
 * The signed-in user, for client components that shape themselves around role —
 * hiding nav an organiser cannot use, for instance. Presentation only: every
 * screen behind it is still gated server-side and every endpoint checks again.
 */
export function useViewer() {
  const [viewer, setViewer] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await apiFetch('/api/auth/me', { cache: 'no-store' });
        const data = (await response.json()) as { user?: PublicUser | null };
        if (!cancelled && response.ok) setViewer(data.user ?? null);
      } catch {
        // A failed read simply leaves the shell in its most restricted state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { viewer, loading };
}
