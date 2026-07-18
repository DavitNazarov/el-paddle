'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  FeedbackBanner,
  MetaRow,
  SurfaceCard,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { EventDto, RegistrationDto } from '@/types/admin';
import { AdminShell } from './AdminShell';

export function AdminRegistrationEventsClient() {
  const { dictionary, formatDate } = useI18n();
  const copy = dictionary.dashboard.admin.registrationsPage;
  const [events, setEvents] = useState<EventDto[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [eventResponse, registrationResponse] = await Promise.all([
        apiFetch('/api/events?scope=admin', { cache: 'no-store' }),
        apiFetch('/api/admin/registrations', { cache: 'no-store' }),
      ]);
      const eventData = await eventResponse.json() as { events?: EventDto[]; error?: string };
      const registrationData = await registrationResponse.json() as {
        registrations?: RegistrationDto[];
        error?: string;
      };
      if (cancelled) return;
      if (!eventResponse.ok || !registrationResponse.ok) {
        setError(eventData.error ?? registrationData.error ?? copy.loadFailed);
      } else {
        setEvents(eventData.events ?? []);
        setRegistrations(registrationData.registrations ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [copy.loadFailed]);

  const registrationCounts = useMemo(() => {
    const counts = new Map<string, { total: number; pending: number }>();
    for (const registration of registrations) {
      const current = counts.get(registration.event.id) ?? { total: 0, pending: 0 };
      current.total += 1;
      if (registration.status === 'PENDING') current.pending += 1;
      counts.set(registration.event.id, current);
    }
    return counts;
  }, [registrations]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events],
  );

  return (
    <AdminShell title={copy.eventListTitle} description={copy.eventListDescription} eyebrow={copy.eyebrow}>
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}
      {loading ? <EmptyState title={copy.loadingEvents} icon={CalendarDays} /> : null}
      {!loading && !error && !sortedEvents.length ? (
        <EmptyState title={copy.noEventsTitle} description={copy.noEventsDescription} icon={CalendarDays} />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {sortedEvents.map((event) => {
          const counts = registrationCounts.get(event.id) ?? { total: 0, pending: 0 };
          return (
            <SurfaceCard key={event.id}>
              <div className="flex h-full flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-[rgba(213,201,177,0.18)] bg-transparent text-[rgba(213,201,177,0.7)]">
                    {copy.teamCount.replace('{count}', String(counts.total))}
                  </Badge>
                  {counts.pending ? (
                    <Badge className="border-transparent bg-amber-500 text-[var(--padel-ink)]">
                      {copy.pendingCount.replace('{count}', String(counts.pending))}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="font-display mt-4 text-xl font-semibold text-[var(--padel-ivory)]">{event.title}</h2>
                <div className="mt-3 grid gap-2">
                  <MetaRow icon={CalendarDays}>{formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}</MetaRow>
                  <MetaRow icon={MapPin}>{event.location}</MetaRow>
                </div>
                <Button
                  asChild
                  variant={counts.pending ? 'red' : 'outline'}
                  className={cn('mt-5 min-h-11 rounded-md', !counts.pending && softButtonClassName)}
                >
                  <Link href={`/admin/events/${event.id}/registrations`}>
                    <ClipboardList className="h-4 w-4" />
                    {copy.openEventRegistrations}
                  </Link>
                </Button>
              </div>
            </SurfaceCard>
          );
        })}
      </div>
    </AdminShell>
  );
}
