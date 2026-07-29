'use client';

import Link from 'next/link';
import { ArrowRight, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  FeedbackBanner,
  RegistrationStatusBadge,
  SectionHeading,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { StageDots, type RailState } from '@/components/shared/dashboard/DashboardSignals';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { usePlayerDashboard } from '@/hooks/usePlayerDashboard';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import type { DashboardData } from '@/types/dashboard';
import { PlayerShell } from './PlayerShell';
import { RegisterModal } from './PlayerShared';
import { PlayerNextEvent, entryPath, entryStep, entryStepLabel } from './PlayerNextEvent';
import styles from './PlayerHome.module.css';

export function PlayerOverviewClient({
  initialUser,
  initialData = null,
}: {
  initialUser: PublicUser;
  initialData?: DashboardData | null;
}) {
  const { locale, t, formatDate } = useI18n();
  const copy = tournamentCopy[locale].playerHome;
  const api = usePlayerDashboard(initialUser, initialData);
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

  // The entry that belongs to the event being shown, so the hero answers "am I
  // in this one" rather than the weaker "do I have entries somewhere".
  const nextEntry = nextEvent
    ? registrations.find((registration) => registration.event.id === nextEvent.id) ?? null
    : null;
  const recentEntries = registrations.slice(0, 5);

  return (
    <PlayerShell
      user={user}
      pendingCount={registrationCounts.pending}
      title={t('dashboard.player.greeting', { name: user.name || user.fullName })}
      description={tournamentCopy[locale].playerEvent.description}
    >
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error && !api.registerEvent ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <div className="space-y-5">
        <PlayerNextEvent
          event={nextEvent}
          entry={nextEntry}
          loading={loading}
          action={
            nextEvent && !registeredEventIds.has(nextEvent.id) ? (
              <Button variant="red" className="min-h-11 rounded-md" onClick={() => openRegister(nextEvent)}>
                {copy.register}
              </Button>
            ) : null
          }
        />

        {/* The record is context, not the headline — a slim strip under the
            event rather than four tiles competing with it. */}
        <section aria-label={copy.record} className={styles.record}>
          <div className={styles.recordCell}>
            <p className={styles.recordValue}>{user.stats.matchesPlayed}</p>
            <p className={styles.recordLabel}>{copy.matches}</p>
          </div>
          <div className={styles.recordCell}>
            <p className={styles.recordValue}>{user.stats.wins}</p>
            <p className={styles.recordLabel}>{copy.wins}</p>
          </div>
          <div className={styles.recordCell}>
            <p className={styles.recordValue}>{user.stats.losses}</p>
            <p className={styles.recordLabel}>{copy.losses}</p>
          </div>
          <div className={styles.recordCell}>
            <p className={styles.recordValue}>{winRate === null ? '—' : `${winRate}%`}</p>
            <p className={styles.recordLabel}>{copy.winRate}</p>
          </div>
        </section>

        <TournamentPanel labelledBy="player-entries">
          <TournamentSectionHeader
            id="player-entries"
            title={copy.entries}
            description={copy.entriesDescription}
            actions={
              registrations.length ? (
                <StatusLabel>{fillTemplate(copy.entryCount, { count: registrations.length })}</StatusLabel>
              ) : undefined
            }
          />
          {recentEntries.length ? (
            <ul>
              {recentEntries.map((registration) => {
                const step = entryStep(registration.status);
                return (
                  <li key={registration.id} className={styles.entryRow}>
                    <div className={styles.entryRowText}>
                      <p className={styles.entryRowTitle}>{registration.event.title}</p>
                      <p className={styles.entryRowMeta}>
                        {registration.category.name} · {formatDate(registration.event.date, { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <div className={styles.entryRowState}>
                      {step >= 0 ? (
                        <StageDots
                          states={entryPath.map((_, index): RailState =>
                            index < step ? 'done' : index === step ? 'current' : 'upcoming')}
                          label={copy[entryPath[step]!]}
                          srLabel={entryStepLabel(registration.status, locale)}
                        />
                      ) : (
                        <RegistrationStatusBadge status={registration.status} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : loading ? (
            <SkeletonRows rows={3} label={tournamentCopy[locale].common.loading} />
          ) : (
            <div className="p-4 sm:p-5">
              <EmptyState
                title={copy.noEntries}
                description={copy.noEntriesDetail}
                icon={ListChecks}
                action={
                  <Button asChild variant="red" className="min-h-11 rounded-md">
                    <Link href="/dashboard/events">{copy.browse}</Link>
                  </Button>
                }
              />
            </div>
          )}
        </TournamentPanel>

        {events.length ? (
          <SectionHeading
            title={copy.browse}
            description={tournamentCopy[locale].directories.events.description}
            actions={
              <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                <Link href="/dashboard/events">
                  {copy.viewAll}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            }
          />
        ) : null}
      </div>

      <RegisterModal api={api} />
    </PlayerShell>
  );
}
