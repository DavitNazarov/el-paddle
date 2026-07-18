'use client';

import { useState } from 'react';
import { EmptyState, FeedbackBanner, SectionHeading } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { usePlayerDashboard } from '@/hooks/usePlayerDashboard';
import { CalendarDays, History } from 'lucide-react';
import type { PublicUser } from '@/types/auth';
import type { RegistrationDto } from '@/types/dashboard';
import { ClubLineupEditor } from './ClubLineupEditor';
import { PlayerShell } from './PlayerShell';
import { EventCard, RegisterModal } from './PlayerShared';

export function PlayerEventsClient({ initialUser }: { initialUser: PublicUser }) {
  const { dictionary, t } = useI18n();
  const player = dictionary.dashboard.player;
  const api = usePlayerDashboard(initialUser);
  const [managedEntry, setManagedEntry] = useState<RegistrationDto | null>(null);
  const {
    user,
    events,
    registrations,
    clubMembers,
    clubMembershipRole,
    registrationCounts,
    loading,
    message,
    error,
    setMessage,
    openRegister,
    loadDashboard,
  } = api;
  const clubPlayers = [user, ...clubMembers].filter(
    (member, index, all) => all.findIndex((candidate) => candidate.id === member.id) === index,
  );
  const upcomingEvents = events
    .filter((event) => event.status !== 'COMPLETED')
    .sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime());
  const finishedEvents = events
    .filter((event) => event.status === 'COMPLETED')
    .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());

  const eventCount = (count: number) => (
    <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--dash-border)] bg-white px-3 text-xs font-semibold text-[var(--dash-muted)] shadow-[0_1px_2px_rgba(25,50,77,0.04)]">
      {t('dashboard.player.sections.eventCount', { count })}
    </span>
  );

  const eventCard = (event: (typeof events)[number]) => (
    <EventCard
      key={event.id}
      event={event}
      clubEntries={registrations.filter((registration) => registration.event.id === event.id)}
      canEditRegistration={clubMembershipRole === 'LEADER'}
      onRegister={openRegister}
      onEditRegistration={setManagedEntry}
    />
  );

  return (
    <PlayerShell
      user={user}
      pendingCount={registrationCounts.pending}
      eyebrow={player.pages.eventsEyebrow}
      title={player.pages.eventsTitle}
      description={player.pages.eventsDescription}
    >
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error && !api.registerEvent ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      {loading ? (
        <div className="mt-5">
          <EmptyState title={player.sections.loadingTitle} description={player.sections.loadingDescription} icon={CalendarDays} />
        </div>
      ) : null}

      {!loading && !events.length ? (
        <div className="mt-5">
          <EmptyState title={player.sections.noEventsTitle} description={player.sections.noEventsDescription} icon={CalendarDays} />
        </div>
      ) : null}

      {!loading && events.length ? (
        <div className="space-y-12">
          <section aria-label={player.sections.upcomingEventsTitle}>
            <SectionHeading
              title={player.sections.upcomingEventsTitle}
              description={player.sections.upcomingEventsDescription}
              actions={eventCount(upcomingEvents.length)}
            />
            <div className="mt-5 grid gap-4">
              {upcomingEvents.length ? (
                upcomingEvents.map(eventCard)
              ) : (
                <EmptyState
                  title={player.sections.noUpcomingEventsTitle}
                  description={player.sections.noUpcomingEventsDescription}
                  icon={CalendarDays}
                />
              )}
            </div>
          </section>

          <section aria-label={player.sections.finishedEventsTitle}>
            <SectionHeading
              title={player.sections.finishedEventsTitle}
              description={player.sections.finishedEventsDescription}
              actions={eventCount(finishedEvents.length)}
            />
            <div className="mt-5 grid gap-4">
              {finishedEvents.length ? (
                finishedEvents.map(eventCard)
              ) : (
                <EmptyState
                  title={player.sections.noFinishedEventsTitle}
                  description={player.sections.noFinishedEventsDescription}
                  icon={History}
                />
              )}
            </div>
          </section>
        </div>
      ) : null}

      <RegisterModal api={api} />
      {managedEntry ? (
        <ClubLineupEditor
          key={`${managedEntry.id}:${managedEntry.version}`}
          registration={managedEntry}
          clubPlayers={clubPlayers}
          onClose={() => setManagedEntry(null)}
          onConflict={() => loadDashboard(false)}
          onUpdated={async () => {
            setManagedEntry(null);
            setMessage(player.clubEntries.success);
            await loadDashboard(false);
          }}
        />
      ) : null}
    </PlayerShell>
  );
}
