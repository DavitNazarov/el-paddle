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
  Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AttentionRow,
  EmptyState,
  Metric,
  RegistrationStatusBadge,
  SectionHeading,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { cn } from '@/lib/utils';
import { AdminShell } from './AdminShell';
import type { EventDto, RegistrationDto } from '@/types/admin';

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
      declined: registrations.filter((item) => item.status === 'DECLINED').length,
    }),
    [events, registrations],
  );

  const pendingQueue = registrations.filter((item) => item.status === 'PENDING').slice(0, 6);
  const draftEvents = events.filter((item) => !item.isPublished).slice(0, 4);

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={dictionary.dashboard.admin.shell.eyebrow}>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={dictionary.dashboard.admin.stats[0][0]} value={counts.pending} hint={dictionary.dashboard.admin.stats[0][1]} tone="warning" />
        <Metric label={dictionary.dashboard.admin.stats[1][0]} value={counts.approved} hint={dictionary.dashboard.admin.stats[1][1]} tone="success" />
        <Metric label={dictionary.dashboard.admin.stats[2][0]} value={counts.published} hint={dictionary.dashboard.admin.stats[2][1]} tone="info" />
        <Metric label={dictionary.dashboard.admin.stats[3][0]} value={counts.declined} hint={dictionary.dashboard.admin.stats[3][1]} tone="danger" />
      </section>

      <section className="mt-6">
        <SectionHeading title={copy.workflowTitle} description={copy.workflowDescription} />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {copy.steps.map((step, index) => (
            <Link
              key={step.title}
              href={step.href}
              className="dash-attention group transition-colors hover:border-[rgba(213,201,177,0.22)] hover:bg-[rgba(213,201,177,0.05)]"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[rgba(213,201,177,0.08)] text-xs font-semibold text-[rgba(213,201,177,0.7)]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--padel-ivory)]">{step.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-[rgba(213,201,177,0.45)]">{step.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[rgba(213,201,177,0.35)] transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section>
          <SectionHeading
            title={copy.pendingTitle}
            description={copy.pendingDescription}
            actions={
              counts.pending > 0 ? (
                <Button asChild size="sm" variant="red" className="rounded-md">
                  <Link href="/admin/registrations">{copy.reviewAll}</Link>
                </Button>
              ) : null
            }
          />
          <div className="mt-3 grid gap-2">
            {loading ? <EmptyState title={copy.loading} icon={ClipboardList} /> : null}
            {!loading && !pendingQueue.length ? (
              <EmptyState title={copy.noPendingTitle} description={copy.noPendingDescription} icon={CheckCircle2} />
            ) : null}
            {pendingQueue.map((registration) => (
              <AttentionRow
                key={registration.id}
                urgent
                title={registration.event.title}
                detail={`${registration.owner.fullName} / ${registration.teammate.fullName} · ${formatDate(registration.event.date, { dateStyle: 'medium' })}`}
                action={
                  <div className="flex items-center gap-2">
                    <RegistrationStatusBadge status={registration.status} />
                    <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                      <Link href={`/admin/events/${registration.event.id}/registrations`}>{copy.review}</Link>
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </section>

        <section>
          <SectionHeading
            title={copy.draftsTitle}
            description={copy.draftsDescription}
            actions={
              counts.drafts > 0 ? (
                <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                  <Link href="/admin/events">{copy.manageEvents}</Link>
                </Button>
              ) : null
            }
          />
          <div className="mt-3 grid gap-2">
            {loading ? <EmptyState title={copy.loading} icon={CalendarDays} /> : null}
            {!loading && !draftEvents.length ? (
              <EmptyState
                title={copy.noDraftsTitle}
                description={copy.noDraftsDescription}
                icon={CalendarPlus}
                action={
                  <Button asChild size="sm" variant="red" className="rounded-md">
                    <Link href="/admin/events">{copy.createEvent}</Link>
                  </Button>
                }
              />
            ) : null}
            {draftEvents.map((event) => (
              <AttentionRow
                key={event.id}
                title={event.title}
                detail={`${event.location} · ${formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}`}
                action={
                  <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                    <Link href="/admin/events">{copy.publishNow}</Link>
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6">
        <SectionHeading title={copy.quickActionsTitle} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: '/admin/categories', label: copy.quickCategories, icon: Tags },
            { href: '/admin/events', label: copy.quickEvents, icon: CalendarPlus },
            { href: '/admin/registrations', label: copy.quickRegistrations, icon: ClipboardList },
            { href: '/admin/clubs', label: copy.quickClubs, icon: Building2 },
          ].map((action) => (
            <Button
              key={action.href}
              asChild
              variant="outline"
              className={cn(softButtonClassName, 'h-auto min-h-14 justify-start gap-3 rounded-lg px-4 py-3')}
            >
              <Link href={action.href}>
                <action.icon className="h-4 w-4 text-[rgba(213,201,177,0.5)]" />
                <span>{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
