'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ListChecks, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AttentionRow,
  EmptyState,
  FeedbackBanner,
  RegistrationStatusBadge,
  SectionHeading,
  SurfaceCard,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { StageDots, type RailState } from '@/components/shared/dashboard/DashboardSignals';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { usePlayerDashboard } from '@/hooks/usePlayerDashboard';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import type { DashboardData, EventDto } from '@/types/dashboard';
import { PlayerShell } from './PlayerShell';
import { OpponentRequestModal } from './OpponentRequestModal';
import { RegisterModal } from './PlayerShared';
import { PlayerNextEvent, PlayerNextMatch, entryPath, entryStage, entryStepLabel } from './PlayerNextEvent';
import { pairingState, type PairingState } from './pairingModel';
import styles from './PlayerHome.module.css';

/** A compact open-event invitation: name, date, who is already in, one action. */
function OpenEventCard({
  event,
  onRegister,
}: {
  event: EventDto;
  onRegister: (event: EventDto) => void;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].playerHome;
  const teamsIn = event.teamsIn ?? 0;

  return (
    <SurfaceCard className="flex min-w-0 flex-col gap-3 p-5">
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-[var(--dash-text)]">{event.title}</h3>
        <div className="mt-2 grid gap-1.5 text-sm text-[var(--dash-muted)]">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-[var(--dash-faint)]" aria-hidden="true" />
            {formatDate(event.date, { dateStyle: 'medium' })}
          </span>
          <span className="inline-flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4 shrink-0 text-[var(--dash-faint)]" aria-hidden="true" />
            <span className="truncate">{event.location}</span>
          </span>
          {/* Social proof — a real count, never an invented zero. */}
          {teamsIn > 0 ? (
            <span className="inline-flex items-center gap-2 font-medium text-[var(--dash-teal)]">
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              {teamsIn === 1 ? copy.teamsInOne : fillTemplate(copy.teamsInMany, { count: teamsIn })}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="red" className="min-h-11 rounded-md" onClick={() => onRegister(event)}>
          {copy.register}
        </Button>
        <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md')}>
          <Link href={`/dashboard/events/${event.id}`}>{copy.openEvent}</Link>
        </Button>
      </div>
    </SurfaceCard>
  );
}

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
    personalRegistrations,
    registeredEventIds,
    nextEvent,
    nextMatch,
    receivedRequests,
    sentRequests,
    requestWindows,
    winRate,
    loading,
    loadFailed,
    message,
    error,
    openRegister,
    loadDashboard,
  } = api;

  // The entry that belongs to the event being shown, so the hero answers "am I
  // in this one" rather than the weaker "do I have entries somewhere".
  const nextEntry = nextEvent
    ? registrations.find((registration) => registration.event.id === nextEvent.id) ?? null
    : null;
  // Pairing is scoped to the reader's *own* entries. A club mate's team shows in
  // the list above, but only its two players may ask an opponent for it — the
  // hero used to offer the action for any club entry and take the 404 on submit.
  const nextOwnEntries = useMemo(
    () =>
      nextEvent
        ? personalRegistrations.filter((registration) => registration.event.id === nextEvent.id)
        : [],
    [nextEvent, personalRegistrations],
  );
  const nextApprovedEntries = useMemo(
    () => nextOwnEntries.filter((registration) => registration.status === 'APPROVED'),
    [nextOwnEntries],
  );
  const pairing = useMemo(
    () =>
      nextEvent
        ? pairingState({
            eventId: nextEvent.id,
            entries: nextOwnEntries,
            received: receivedRequests,
            sent: sentRequests,
            windows: requestWindows,
          })
        : ({ kind: 'none' } as PairingState),
    [nextEvent, nextOwnEntries, receivedRequests, sentRequests, requestWindows],
  );
  const nextInDraw = nextApprovedEntries.some((registration) => registration.inDraw);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const recentEntries = registrations.slice(0, 5);

  // Everything waiting on the *player*: entries the organiser sent back, and
  // opponent requests awaiting their answer. Empty means the strip disappears.
  const needsChangesEntries = personalRegistrations.filter(
    (registration) => registration.status === 'NEEDS_CHANGES',
  );
  const forYouCount = needsChangesEntries.length + receivedRequests.length;

  // Open events the player's club has not entered yet — invitations, not a list.
  const openEvents = events
    .filter((event) => event.status === 'REGISTRATION_OPEN' && !registeredEventIds.has(event.id))
    .slice(0, 3);

  useTournamentRealtime({
    eventId: nextMatch?.eventId,
    matchId: nextMatch?.id,
    onChange: () => {
      void loadDashboard(false);
    },
  });

  return (
    <PlayerShell
      user={user}
      title={t('dashboard.player.greeting', { name: user.name || user.fullName })}
      description={t('dashboard.player.pages.overviewDescription')}
    >
      {loadFailed ? (
        <FeedbackBanner
          kind="error"
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(softButtonClassName, 'min-h-11 rounded-md')}
              onClick={() => void loadDashboard()}
            >
              {copy.retry}
            </Button>
          }
        >
          {copy.loadFailed}
        </FeedbackBanner>
      ) : null}
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error && !api.registerEvent ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <div className="space-y-5">
        {forYouCount > 0 ? (
          <TournamentPanel labelledBy="player-for-you">
            <TournamentSectionHeader
              id="player-for-you"
              title={copy.forYou}
              description={copy.forYouDescription}
            />
            <div className="grid gap-2 p-4 sm:p-5">
              {needsChangesEntries.map((registration) => (
                <AttentionRow
                  key={registration.id}
                  urgent
                  title={fillTemplate(copy.fixEntry, { event: registration.event.title })}
                  detail={registration.publicStatusReason || undefined}
                  action={
                    <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md')}>
                      <Link href={`/dashboard/events/${registration.event.id}`}>{copy.fixEntryAction}</Link>
                    </Button>
                  }
                />
              ))}
              {receivedRequests.map((request) => (
                <AttentionRow
                  key={request.id}
                  urgent
                  title={fillTemplate(copy.requestFrom, {
                    pair: request.from ? `${request.from.ownerName} / ${request.from.teammateName}` : '…',
                    event: request.eventTitle,
                  })}
                  action={
                    <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md')}>
                      <Link href={`/dashboard/events/${request.eventId}`}>{copy.respond}</Link>
                    </Button>
                  }
                />
              ))}
            </div>
          </TournamentPanel>
        ) : null}

        {/* On match day the court and the opponent outrank any countdown. */}
        {nextMatch ? (
          <PlayerNextMatch match={nextMatch} />
        ) : (
          <PlayerNextEvent
            event={nextEvent}
            entry={nextEntry}
            pairing={pairing}
            loading={loading}
            action={
              nextEvent ? (
                <>
                  {/* One pairing action at a time, and only the one that can
                      actually be taken: answer, watch, or ask. */}
                  {pairing.kind === 'respond' ? (
                    <Button asChild variant="red" className="min-h-11 rounded-md">
                      <Link href={`/dashboard/events/${nextEvent.id}`}>
                        {pairing.count > 1
                          ? fillTemplate(copy.respondRequests, { count: pairing.count })
                          : copy.respondRequest}
                      </Link>
                    </Button>
                  ) : null}
                  {pairing.kind === 'sent' ? (
                    <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md')}>
                      <Link href={`/dashboard/events/${nextEvent.id}`}>{copy.viewRequest}</Link>
                    </Button>
                  ) : null}
                  {pairing.kind === 'ask' ? (
                    <Button variant="red" className="min-h-11 rounded-md" onClick={() => setRequestModalOpen(true)}>
                      {copy.sendOpponentRequest}
                    </Button>
                  ) : null}
                  {/* Matches exist only once the draw is published; before that
                      this button led to an empty page. */}
                  {nextInDraw ? (
                    <Button asChild variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md')}>
                      <Link href={`/dashboard/events/${nextEvent.id}/matches`}>{copy.seeMyMatches}</Link>
                    </Button>
                  ) : null}
                  {nextEvent.status === 'REGISTRATION_OPEN' && !registeredEventIds.has(nextEvent.id) ? (
                    <Button variant="red" className="min-h-11 rounded-md" onClick={() => openRegister(nextEvent)}>
                      {copy.register}
                    </Button>
                  ) : null}
                </>
              ) : null
            }
          />
        )}

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
                <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md')}>
                  <Link href="/dashboard/entries">
                    {copy.viewAll}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : undefined
            }
          />
          {recentEntries.length ? (
            <ul>
              {recentEntries.map((registration) => {
                const stage = entryStage(registration);
                return (
                  <li key={registration.id} className={styles.entryRowItem}>
                    {/* The whole row is the doorway to the event, not a dead list item. */}
                    <Link
                      href={`/dashboard/events/${registration.event.id}`}
                      className={cn(styles.entryRow, 'group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--padel-focus-ring)]')}
                    >
                      <div className={styles.entryRowText}>
                        <p className={cn(styles.entryRowTitle, 'group-hover:underline')}>
                          {registration.event.title}
                        </p>
                        <p className={styles.entryRowMeta}>
                          {registration.category.name} · {formatDate(registration.event.date, { dateStyle: 'medium' })}
                        </p>
                      </div>
                      <div className={styles.entryRowState}>
                        {stage.kind === 'path' ? (
                          stage.attention ? (
                            <StatusLabel icon={stage.attention === 'NEEDS_CHANGES' ? 'warning' : 'dot'}>
                              {entryStepLabel(registration, locale)}
                            </StatusLabel>
                          ) : (
                            <StageDots
                              states={entryPath.map((_, index): RailState =>
                                index < stage.step ? 'done' : index === stage.step ? 'current' : 'upcoming')}
                              label={copy[entryPath[stage.step]!]}
                              srLabel={entryStepLabel(registration, locale)}
                            />
                          )
                        ) : (
                          <RegistrationStatusBadge status={registration.status} />
                        )}
                        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--dash-faint)]" aria-hidden="true" />
                      </div>
                    </Link>
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

        {openEvents.length ? (
          <section aria-labelledby="player-open-events" className="space-y-3">
            <SectionHeading
              id="player-open-events"
              title={copy.openEventsTitle}
              description={copy.openEventsDescription}
              actions={
                <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md')}>
                  <Link href="/dashboard/events">
                    {copy.browseAll}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {openEvents.map((event) => (
                <OpenEventCard key={event.id} event={event} onRegister={openRegister} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <RegisterModal api={api} />
      {nextEvent && nextApprovedEntries.length ? (
        <OpponentRequestModal
          open={requestModalOpen}
          onOpenChange={setRequestModalOpen}
          eventId={nextEvent.id}
          approvedEntries={nextApprovedEntries}
          onSent={() => {
            void loadDashboard();
          }}
        />
      ) : null}
    </PlayerShell>
  );
}
