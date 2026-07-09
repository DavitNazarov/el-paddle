'use client';

import { EmptyState, FeedbackBanner, SectionHeading } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { usePlayerDashboard } from '@/hooks/usePlayerDashboard';
import { CalendarDays } from 'lucide-react';
import type { PublicUser } from '@/types/auth';
import { PlayerShell } from './PlayerShell';
import { EventCard, RegisterModal } from './PlayerShared';

export function PlayerEventsClient({ initialUser }: { initialUser: PublicUser }) {
  const { dictionary } = useI18n();
  const player = dictionary.dashboard.player;
  const api = usePlayerDashboard(initialUser);
  const { user, events, registrationKeys, registeredEventIds, registrationCounts, loading, message, error, openRegister } = api;

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

      <SectionHeading
        title={player.sections.upcomingTitle}
        description={player.sections.upcomingDescription}
      />

      <div className="mt-4 grid gap-3">
        {loading ? (
          <EmptyState title={player.sections.loadingTitle} description={player.sections.loadingDescription} icon={CalendarDays} />
        ) : null}
        {!loading && !events.length ? (
          <EmptyState title={player.sections.noEventsTitle} description={player.sections.noEventsDescription} icon={CalendarDays} />
        ) : null}
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            registrationKeys={registrationKeys}
            registeredEventIds={registeredEventIds}
            onRegister={openRegister}
          />
        ))}
      </div>

      <RegisterModal api={api} />
    </PlayerShell>
  );
}
