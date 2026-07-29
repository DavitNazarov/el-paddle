'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, CalendarPlus, CheckCircle2, ClipboardList, Handshake } from 'lucide-react';
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
import { useAdminCounts } from '@/hooks/useAdminCounts';
import { useEventOperations } from '@/hooks/useEventOperations';
import { useViewer } from '@/hooks/useViewer';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { cn } from '@/lib/utils';
import { AdminShell } from './AdminShell';
import { AdminEventBoard } from './AdminEventBoard';
import type { EventDto, RegistrationDto } from '@/types/admin';

export function AdminOverviewClient() {
  const { dictionary, locale, formatDate } = useI18n();
  const copy = dictionary.dashboard.admin.overview;
  const countCopy = dictionary.dashboard.admin.counts;
  const board = tournamentCopy[locale].admin.board;
  // Counts come from the single summary source the sidebar also uses, so the
  // Overview and the sidebar snapshot can never drift apart.
  const { counts } = useAdminCounts();
  const { operations, loading: operationsLoading } = useEventOperations();
  const { viewer } = useViewer();
  const [events, setEvents] = useState<EventDto[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Organisers run events and nothing else, so platform totals, the draft
  // publishing queue, and the first-run setup path are not part of their home.
  const isOrganiser = viewer?.role === 'ORGANISER';

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

  const pendingQueue = registrations.filter((item) => item.status === 'PENDING').slice(0, 5);
  const draftEvents = events.filter((item) => !item.isPublished).slice(0, 4);
  // The setup path only helps before there is anything to run.
  const showSetup = !loading && !isOrganiser && events.length === 0;
  const eventsNeedingPairings = [...operations.values()].filter((row) => row.requests.awaiting > 0);
  const hasDecisions = pendingQueue.length > 0 || eventsNeedingPairings.length > 0;

  return (
    // No eyebrow is passed: the shell names the workspace by role.
    <AdminShell title={copy.title} description={copy.description}>
      <div className="space-y-6">
        {/* The board leads. Before any platform total, the reader wants to know
            which event is running and which one is stuck. */}
        <AdminEventBoard
          events={events}
          operations={operations}
          loading={loading || operationsLoading}
          isOrganiser={isOrganiser}
        />

        {showSetup ? (
          <section>
            <SectionHeading title={copy.workflowTitle} description={copy.workflowDescription} />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {copy.steps.map((step, index) => (
                <Link
                  key={step.title}
                  href={step.href}
                  className="dash-attention group transition-colors hover:border-[var(--dash-border-strong)] hover:bg-[var(--dash-tint)]"
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--dash-tint-strong)] text-xs font-semibold text-[var(--dash-muted)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--dash-text)]">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--dash-muted)]">{step.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--dash-faint)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionHeading
            title={board.decisions}
            description={board.decisionsDescription}
            actions={
              pendingQueue.length > 0 ? (
                <Button asChild size="sm" variant="red" className="rounded-md">
                  <Link href="/admin/registrations">{copy.reviewAll}</Link>
                </Button>
              ) : null
            }
          />
          <div className="mt-3 grid gap-2">
            {loading ? <EmptyState title={copy.loading} icon={ClipboardList} /> : null}
            {!loading && !hasDecisions ? (
              <EmptyState title={board.allClear} description={copy.noPendingDescription} icon={CheckCircle2} />
            ) : null}

            {/* Pairings are counted per event rather than listed one by one: the
                decision itself is taken inside that event's request screen. */}
            {eventsNeedingPairings.map((row) => {
              const event = events.find((item) => item.id === row.eventId);
              if (!event) return null;
              return (
                <AttentionRow
                  key={row.eventId}
                  urgent
                  title={event.title}
                  detail={fillTemplate(board.pairings, { count: row.requests.awaiting })}
                  action={
                    <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                      <Link href={`/admin/events/${row.eventId}/opponent-requests`}>
                        <Handshake className="h-4 w-4" />
                        {board.review}
                      </Link>
                    </Button>
                  }
                />
              );
            })}

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

        {isOrganiser ? null : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <SectionHeading title={countCopy.events} description={copy.pendingDescription} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Metric
                  label={countCopy.events}
                  value={counts.events}
                  hint={`${counts.published} ${countCopy.published.toLowerCase()} · ${counts.drafts} ${countCopy.drafts.toLowerCase()}`}
                />
                <Metric label={countCopy.pending} value={counts.pending} tone={counts.pending > 0 ? 'warning' : 'neutral'} />
                <Metric label={countCopy.approved} value={counts.approved} tone={counts.approved > 0 ? 'success' : 'neutral'} />
                <Metric
                  label={countCopy.applications}
                  value={counts.applications}
                  tone={counts.applications > 0 ? 'info' : 'neutral'}
                  hint={`${countCopy.clubs}: ${counts.clubs}`}
                />
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
        )}
      </div>
    </AdminShell>
  );
}
