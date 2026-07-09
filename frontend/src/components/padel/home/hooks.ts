'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export type PublicCategory = {
  id: string;
  name: string;
  description: string;
};

export type PublicEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  arrivalTime: string | null;
  participationFee: number;
  bankAccountIban: string;
  bankAccountReceiver: string;
  categories: PublicCategory[];
};

export type PublicEventsPayload = {
  upcoming: PublicEvent | null;
  previous: PublicEvent[];
};

export function usePublicEvents() {
  const [payload, setPayload] = useState<PublicEventsPayload>({
    upcoming: null,
    previous: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiFetch('/api/public/events', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Events unavailable');
        return response.json();
      })
      .then((data: PublicEventsPayload) => {
        if (mounted) {
          setPayload({
            upcoming: data.upcoming ?? null,
            previous: Array.isArray(data.previous) ? data.previous : [],
          });
        }
      })
      .catch(() => {
        if (mounted) {
          setPayload({ upcoming: null, previous: [] });
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { payload, loading };
}
