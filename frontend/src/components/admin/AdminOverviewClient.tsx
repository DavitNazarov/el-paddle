'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarPlus, Handshake, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  RegistrationStatusBadge,
  SectionHeading,
} from '@/components/shared/dashboard/DashboardUI';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { useAdminCounts } from '@/hooks/useAdminCounts';
import { useEventOperations } from '@/hooks/useEventOperations';
import { useViewer } from '@/hooks/useViewer';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { AdminShell } from './AdminShell';
import { AdminAttentionQueue, type AttentionItem } from './AdminAttentionQueue';
import { AdminEventBoard } from './AdminEventBoard';
import { AdminStatsSection } from './stats/AdminStatsSection';
import type { EventDto, RegistrationDto } from '@/types/admin';

export function AdminOverviewClient() {
  const { dictionary, locale, formatDate } = useI18n();
  const copy = dictionary.dashboard.admin.overview;
  const navCopy = dictionary.dashboard.admin.nav;
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

  // One queue, ordered by who is blocked. Pairings stop a draw from being built,
  // entries and club requests hold a person up, and an unpublished event blocks
  // nobody — it is simply not started yet, so it never carries the amber spine.
  const attentionItems: AttentionItem[] = [
    ...eventsNeedingPairings.flatMap((row) => {
      const event = events.find((item) => item.id === row.eventId);
      if (!event) return [];
      return [
        {
          id: `pairings-${row.eventId}`,
          title: event.title,
          detail: fillTemplate(board.pairings, { count: row.requests.awaiting }),
          urgent: true,
          actionLabel: board.review,
          href: `/admin/events/${row.eventId}/opponent-requests`,
          icon: Handshake,
        },
      ];
    }),
    ...pendingQueue.map((registration) => ({
      id: `entry-${registration.id}`,
      title: registration.event.title,
      detail: `${registration.owner.fullName} / ${registration.teammate.fullName} · ${formatDate(registration.event.date, { dateStyle: 'medium' })}`,
      urgent: true,
      actionLabel: copy.review,
      href: `/admin/events/${registration.event.id}/registrations`,
      badge: <RegistrationStatusBadge status={registration.status} />,
    })),
    // Club requests were previously only a number on this page, with nothing to
    // click — yet nobody exists in the product until an admin approves them.
    ...(!isOrganiser && counts.applications > 0
      ? [
          {
            id: 'applications',
            title: navCopy.applications,
            detail: fillTemplate(board.applicationsWaiting, { count: counts.applications }),
            urgent: true,
            actionLabel: board.review,
            href: '/admin/applications',
            icon: Inbox,
          },
        ]
      : []),
    ...(isOrganiser
      ? []
      : draftEvents.map((event) => ({
          id: `draft-${event.id}`,
          title: event.title,
          detail: `${board.draftNotPublished} · ${event.location} · ${formatDate(event.date, { dateStyle: 'medium' })}`,
          urgent: false,
          actionLabel: copy.publishNow,
          href: '/admin/events',
          icon: CalendarPlus,
        }))),
  ];

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

        <AdminAttentionQueue
          items={attentionItems}
          loading={loading || operationsLoading}
          title={board.decisions}
          description={board.decisionsDescription}
          emptyTitle={board.allClear}
          emptyDescription={copy.noPendingDescription}
          loadingLabel={copy.loading}
          actions={
            pendingQueue.length > 0 ? (
              <Button asChild size="sm" variant="red" className="rounded-md">
                <Link href="/admin/registrations">{copy.reviewAll}</Link>
              </Button>
            ) : null
          }
        />

        {/* Statistics come last: the queue above says what to do now, statistics
            say how the platform is moving, which is one step further from an
            action. Organisers hold no power over anything counted here. */}
        {isOrganiser ? null : <AdminStatsSection />}
      </div>
    </AdminShell>
  );
}
