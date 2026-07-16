'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Clock,
  ListChecks,
  MapPin,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AttentionRow,
  EmptyState,
  FeedbackBanner,
  MetaRow,
  Metric,
  RegistrationStatusBadge,
  SectionHeading,
  SurfaceCard,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { usePlayerDashboard } from '@/hooks/usePlayerDashboard';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import { PlayerShell } from './PlayerShell';
import { RegisterModal } from './PlayerShared';

export function PlayerOverviewClient({ initialUser }: { initialUser: PublicUser }) {
  const { dictionary, t, formatDate } = useI18n();
  const player = dictionary.dashboard.player;
  const api = usePlayerDashboard(initialUser);
  const {
    user,
    events,
    registrations,
    registrationCounts,
    registeredEventIds,
    nextEvent,
    winRate,
    loading,
    message,
    error,
    openRegister,
  } = api;

  const recentEntries = registrations.slice(0, 4);

  return (
    <PlayerShell
      user={user}
      pendingCount={registrationCounts.pending}
      title={t('dashboard.player.greeting', { name: user.name || user.fullName })}
      description={player.pages.overviewDescription}
    >
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error && !api.registerEvent ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={player.stats[0][0]} value={user.stats.matchesPlayed} />
        <Metric label={player.stats[1][0]} value={user.stats.wins} hint={winRate === null ? undefined : `${winRate}%`} />
        <Metric label={player.mini.pending} value={registrationCounts.pending} />
        <Metric label={player.pages.openEventsMetric} value={events.length} />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SurfaceCard featured>
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="dash-kicker">{player.nextEventLabel}</p>
                {loading ? (
                  <p className="mt-3 text-sm text-[rgba(213,201,177,0.5)]">{player.sections.loadingDescription}</p>
                ) : nextEvent ? (
                  <>
                    <h2 className="mt-2 text-xl font-semibold text-[var(--padel-ivory)]">{nextEvent.title}</h2>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                      <MetaRow icon={CalendarDays}>
                        {formatDate(nextEvent.date, { dateStyle: 'medium', timeStyle: 'short' })}
                      </MetaRow>
                      <MetaRow icon={MapPin}>{nextEvent.location}</MetaRow>
                      {nextEvent.arrivalTime ? (
                        <MetaRow icon={Clock}>
                          {player.arrivalLabel}: {formatDate(nextEvent.arrivalTime, { timeStyle: 'short' })}
                        </MetaRow>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mt-2 text-xl font-semibold text-[var(--padel-ivory)]">{player.sections.noEventsTitle}</h2>
                    <p className="mt-2 text-sm text-[rgba(213,201,177,0.5)]">{player.sections.noEventsDescription}</p>
                  </>
                )}
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[rgba(213,201,177,0.06)] text-[rgba(213,201,177,0.55)]">
                <Trophy className="h-4 w-4" />
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {nextEvent && !registeredEventIds.has(nextEvent.id) ? (
                <Button variant="red" className="rounded-md" onClick={() => openRegister(nextEvent)}>
                  {player.buttons.openRegister}
                </Button>
              ) : null}
              <Button asChild variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                <Link href="/dashboard/events">
                  {player.pages.browseEvents}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="p-4 sm:p-5">
            <SectionHeading title={player.pages.needsAttention} description={player.pages.needsAttentionDescription} />
            <div className="mt-4 grid gap-2">
              {registrationCounts.pending > 0 ? (
                <AttentionRow
                  urgent
                  title={t('dashboard.player.pages.pendingAttention', { count: registrationCounts.pending })}
                  detail={player.pages.pendingAttentionDetail}
                  action={
                    <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                      <Link href="/dashboard/entries">{player.buttons.viewEntries}</Link>
                    </Button>
                  }
                />
              ) : null}
              {events.length > 0 ? (
                <AttentionRow
                  title={t('dashboard.player.pages.openEventsAttention', { count: events.length })}
                  detail={player.pages.openEventsAttentionDetail}
                  action={
                    <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                      <Link href="/dashboard/events">{player.pages.browseEvents}</Link>
                    </Button>
                  }
                />
              ) : null}
              {!registrationCounts.pending && !events.length ? (
                <p className="text-sm text-[rgba(213,201,177,0.48)]">{player.pages.allClear}</p>
              ) : null}
            </div>
          </div>
        </SurfaceCard>
      </div>

      <section className="mt-6">
        <SectionHeading
          title={player.sections.recentEntries}
          description={t('dashboard.player.sections.statusDescription', { count: registrations.length })}
          actions={
            <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
              <Link href="/dashboard/entries">
                {player.pages.viewAllEntries}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <div className="mt-3">
          {loading ? <EmptyState title={player.sections.loadingTitle} icon={ListChecks} /> : null}
          {!loading && !recentEntries.length ? (
            <EmptyState
              title={player.sections.noTeamsTitle}
              description={player.sections.noTeamsDescription}
              icon={ListChecks}
              action={
                <Button asChild variant="red" className="rounded-md">
                  <Link href="/dashboard/events">{player.pages.browseEvents}</Link>
                </Button>
              }
            />
          ) : null}
          {recentEntries.length ? (
            <SurfaceCard>
              <div className="divide-y divide-[rgba(213,201,177,0.08)] px-4 sm:px-5">
                {recentEntries.map((registration) => (
                  <div key={registration.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--padel-ivory)]">{registration.event.title}</p>
                      <p className="mt-0.5 truncate text-xs text-[rgba(213,201,177,0.45)]">
                        {registration.category.name} ·{' '}
                        {formatDate(registration.event.date, { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <RegistrationStatusBadge status={registration.status} />
                  </div>
                ))}
              </div>
            </SurfaceCard>
          ) : null}
        </div>
      </section>

      <RegisterModal api={api} />
    </PlayerShell>
  );
}
