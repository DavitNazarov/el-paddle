'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  Tags,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import {
  EmptyState,
  RegistrationStatusBadge,
  SectionHeading,
  StatCard,
  SurfaceCard,
} from '@/components/padel/DashboardUI';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/padel/I18nProvider';
import { AdminShell } from './AdminShell';
import type { EventDto, RegistrationDto } from './types';

export function AdminOverviewClient() {
  const { dictionary, formatDate } = useI18n();
  const copy = dictionary.dashboard.admin.overview;
  const [events, setEvents] = useState<EventDto[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [eventResponse, registrationResponse] = await Promise.all([
        apiFetch('/api/events?scope=admin', { cache: 'no-store' }),
        apiFetch('/api/admin/registrations', { cache: 'no-store' }),
      ]);
      const eventData = (await eventResponse.json()) as { events: EventDto[] };
      const registrationData = (await registrationResponse.json()) as { registrations: RegistrationDto[] };
      if (!cancelled) {
        setEvents(eventData.events ?? []);
        setRegistrations(registrationData.registrations ?? []);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      pending: registrations.filter((item) => item.status === 'PENDING').length,
      approved: registrations.filter((item) => item.status === 'APPROVED').length,
      published: events.filter((item) => item.isPublished).length,
      drafts: events.filter((item) => !item.isPublished).length,
    }),
    [events, registrations],
  );

  const pendingQueue = registrations.filter((item) => item.status === 'PENDING').slice(0, 5);
  const draftEvents = events.filter((item) => !item.isPublished).slice(0, 3);

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={dictionary.dashboard.admin.shell.eyebrow}>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={dictionary.dashboard.admin.stats[0][0]} value={counts.pending} icon={Clock} tone="warning" description={dictionary.dashboard.admin.stats[0][1]} />
        <StatCard label={dictionary.dashboard.admin.stats[1][0]} value={counts.approved} icon={CheckCircle2} tone="success" description={dictionary.dashboard.admin.stats[1][1]} />
        <StatCard label={dictionary.dashboard.admin.stats[2][0]} value={counts.published} icon={CalendarDays} description={dictionary.dashboard.admin.stats[2][1]} />
        <StatCard label={dictionary.dashboard.admin.stats[3][0]} value={registrations.filter((item) => item.status === 'DECLINED').length} icon={XCircle} tone="danger" description={dictionary.dashboard.admin.stats[3][1]} />
      </section>

      <section className="mt-8">
        <SectionHeading title={copy.workflowTitle} description={copy.workflowDescription} />
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {copy.steps.map((step, index) => (
            <SurfaceCard key={step.title}>
              <CardContent className="p-5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--padel-red)] text-sm font-bold text-[var(--padel-ivory)]">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold text-[var(--padel-ink)]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[rgba(19,2,2,0.58)]">{step.description}</p>
                <Button asChild variant="outline" className="mt-4 border-[rgba(19,2,2,0.12)] bg-white">
                  <Link href={step.href}>
                    {step.action}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </SurfaceCard>
          ))}
        </ol>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading
            title={copy.pendingTitle}
            description={copy.pendingDescription}
            actions={
              counts.pending > 0 ? (
                <Button asChild variant="red" size="sm">
                  <Link href="/admin/registrations">{copy.reviewAll}</Link>
                </Button>
              ) : null
            }
          />
          <div className="mt-4 grid gap-3">
            {loading ? <EmptyState title={copy.loading} icon={ClipboardList} /> : null}
            {!loading && !pendingQueue.length ? (
              <EmptyState title={copy.noPendingTitle} description={copy.noPendingDescription} icon={CheckCircle2} />
            ) : null}
            {pendingQueue.map((registration) => (
              <SurfaceCard key={registration.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <RegistrationStatusBadge status={registration.status} />
                    <h3 className="mt-2 font-semibold text-[var(--padel-ink)]">{registration.event.title}</h3>
                    <p className="mt-1 text-sm text-[rgba(19,2,2,0.58)]">
                      {registration.owner.fullName} / {registration.teammate.fullName}
                    </p>
                    <p className="mt-1 text-xs text-[rgba(19,2,2,0.48)]">
                      {formatDate(registration.event.date, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0 border-[rgba(19,2,2,0.12)] bg-white">
                    <Link href="/admin/registrations">{copy.review}</Link>
                  </Button>
                </CardContent>
              </SurfaceCard>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            title={copy.draftsTitle}
            description={copy.draftsDescription}
            actions={
              counts.drafts > 0 ? (
                <Button asChild variant="outline" size="sm" className="border-[rgba(19,2,2,0.12)] bg-white">
                  <Link href="/admin/events">{copy.manageEvents}</Link>
                </Button>
              ) : null
            }
          />
          <div className="mt-4 grid gap-3">
            {loading ? <EmptyState title={copy.loading} icon={CalendarDays} /> : null}
            {!loading && !draftEvents.length ? (
              <EmptyState
                title={copy.noDraftsTitle}
                description={copy.noDraftsDescription}
                icon={CalendarPlus}
                action={
                  <Button asChild variant="red" size="sm">
                    <Link href="/admin/events">{copy.createEvent}</Link>
                  </Button>
                }
              />
            ) : null}
            {draftEvents.map((event) => (
              <SurfaceCard key={event.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--padel-ink)]">{event.title}</h3>
                    <p className="mt-1 text-sm text-[rgba(19,2,2,0.58)]">{event.location}</p>
                    <p className="mt-1 text-xs text-[rgba(19,2,2,0.48)]">
                      {formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <Button asChild variant="red" size="sm">
                    <Link href="/admin/events">{copy.publishNow}</Link>
                  </Button>
                </CardContent>
              </SurfaceCard>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <SectionHeading title={copy.quickActionsTitle} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: '/admin/categories', label: copy.quickCategories, icon: Tags },
            { href: '/admin/events', label: copy.quickEvents, icon: CalendarPlus },
            { href: '/admin/registrations', label: copy.quickRegistrations, icon: ClipboardList },
            { href: '/admin/clubs', label: copy.quickClubs, icon: Building2 },
          ].map((action) => (
            <Button key={action.href} asChild variant="outline" className="h-auto min-h-16 flex-col gap-2 border-[rgba(19,2,2,0.12)] bg-white py-4">
              <Link href={action.href}>
                <action.icon className="h-5 w-5 text-[var(--padel-red)]" />
                <span>{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
