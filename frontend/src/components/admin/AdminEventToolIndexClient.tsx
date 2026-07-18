'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, GitBranch, Handshake, MapPin } from 'lucide-react';
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
import type { EventDto } from '@/types/admin';
import { AdminShell } from './AdminShell';

type EventTool = 'brackets' | 'opponents' | 'schedule';

const toolConfig = {
  brackets: { suffix: 'bracket', icon: GitBranch },
  opponents: { suffix: 'opponent-requests', icon: Handshake },
  schedule: { suffix: 'schedule', icon: CalendarClock },
} as const;

export function AdminEventToolIndexClient({ tool }: { tool: EventTool }) {
  const { dictionary, formatDate } = useI18n();
  const copy = dictionary.dashboard.admin.operationsPages;
  const pageCopy = copy[tool];
  const config = toolConfig[tool];
  const Icon = config.icon;
  const [events, setEvents] = useState<EventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await apiFetch('/api/events?scope=admin', { cache: 'no-store' });
      const data = await response.json() as { events?: EventDto[]; error?: string };
      if (cancelled) return;
      if (!response.ok) setError(data.error ?? copy.loadFailed);
      else setEvents(data.events ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [copy.loadFailed]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => {
      if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
      if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }),
    [events],
  );

  return (
    <AdminShell title={pageCopy.title} description={pageCopy.description} eyebrow={copy.eyebrow}>
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}
      {loading ? <EmptyState title={copy.loading} icon={Icon} /> : null}
      {!loading && !error && !sortedEvents.length ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} icon={CalendarDays} />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {sortedEvents.map((event) => (
          <SurfaceCard key={event.id}>
            <div className="flex h-full flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-[rgba(213,201,177,0.18)] bg-transparent text-[rgba(213,201,177,0.7)]">
                  {event.status.replaceAll('_', ' ')}
                </Badge>
                {event.categories.map((category) => (
                  <Badge key={category.id} className="border-[rgba(213,201,177,0.12)] bg-transparent text-[rgba(213,201,177,0.55)]">
                    {category.name}
                  </Badge>
                ))}
              </div>
              <h2 className="font-display mt-4 text-xl font-semibold text-[var(--padel-ivory)]">{event.title}</h2>
              <div className="mt-3 grid gap-2">
                <MetaRow icon={CalendarDays}>{formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}</MetaRow>
                <MetaRow icon={MapPin}>{event.location}</MetaRow>
              </div>
              <Button asChild variant="outline" className={`mt-5 min-h-11 rounded-md ${softButtonClassName}`}>
                <Link href={`/admin/events/${event.id}/${config.suffix}`}>
                  <Icon className="h-4 w-4" />
                  {pageCopy.action}
                </Link>
              </Button>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </AdminShell>
  );
}
