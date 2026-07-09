'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AdminCounts, EventDto, RegistrationDto } from '@/types/admin';

const emptyCounts: AdminCounts = {
  pending: 0,
  approved: 0,
  declined: 0,
  published: 0,
  drafts: 0,
  events: 0,
  clubs: 0,
  categories: 0,
};

export function useAdminCounts() {
  const [counts, setCounts] = useState<AdminCounts>(emptyCounts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [categoryResponse, eventResponse, registrationResponse, clubResponse] = await Promise.all([
          apiFetch('/api/categories', { cache: 'no-store' }),
          apiFetch('/api/events?scope=admin', { cache: 'no-store' }),
          apiFetch('/api/admin/registrations', { cache: 'no-store' }),
          apiFetch('/api/admin/clubs', { cache: 'no-store' }),
        ]);

        const categoryData = (await categoryResponse.json()) as { categories: unknown[] };
        const eventData = (await eventResponse.json()) as { events: EventDto[] };
        const registrationData = (await registrationResponse.json()) as { registrations: RegistrationDto[] };
        const clubData = (await clubResponse.json()) as { clubs: unknown[] };

        const events = eventData.events ?? [];
        const registrations = registrationData.registrations ?? [];

        if (!cancelled) {
          setCounts({
            pending: registrations.filter((item) => item.status === 'PENDING').length,
            approved: registrations.filter((item) => item.status === 'APPROVED').length,
            declined: registrations.filter((item) => item.status === 'DECLINED').length,
            published: events.filter((item) => item.isPublished).length,
            drafts: events.filter((item) => !item.isPublished).length,
            events: events.length,
            clubs: (clubData.clubs ?? []).length,
            categories: (categoryData.categories ?? []).length,
          });
        }
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
