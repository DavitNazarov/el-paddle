'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDays, Clock, Handshake, MapPin, Tags, Trophy } from 'lucide-react';
import { StageRail, type RailStep } from '@/components/shared/dashboard/DashboardSignals';
import { StatusLabel } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';
import type { EventDto, NextMatchDto, RegistrationDto } from '@/types/dashboard';
import { entryNoteKey, entryPath, entryStage, entryStep } from './entryStatusModel';
import { pairingNoteKey, type PairingState } from './pairingModel';
import styles from './PlayerHome.module.css';

/**
 * Whole days from now until the event, floored. Rendered as a count rather than
 * a formatted date because "in 6 days" is the fact a competitor is checking;
 * the exact date sits underneath it.
 */
export function daysUntil(date: string, now: Date = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date);
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((startOfTarget - startOfToday) / day);
}

const outlineLinkClassName =
  'inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--dash-border)] px-4 text-sm font-semibold text-[var(--dash-text)] transition-colors hover:border-[var(--dash-border-strong)] hover:bg-[var(--dash-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]';

/**
 * Match-day hero: once the player has a scheduled (or running) match, the
 * court, the time, and the opponent outrank any countdown. This is the one
 * thing a competitor opens the app for on the day.
 */
export function PlayerNextMatch({ match }: { match: NextMatchDto }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].playerHome;
  const eventCopy = tournamentCopy[locale].playerEvent;
  const live = match.status === 'IN_PROGRESS';
  const opponents = match.opponent
    ? `${match.opponent.ownerName} / ${match.opponent.teammateName}`
    : null;
  const yourScore = match.yourSide === 'A' ? match.scoreA : match.scoreB;
  const theirScore = match.yourSide === 'A' ? match.scoreB : match.scoreA;

  return (
    <section className={styles.next} data-live={live || undefined} aria-labelledby="player-next-match">
      <div className={styles.nextTop}>
        <div className={styles.nextCopy}>
          <p className={styles.nextKicker}>{live ? copy.beingPlayed : copy.yourNextMatch}</p>
          <h2 id="player-next-match" className={styles.nextTitle}>
            {opponents ? fillTemplate(copy.youPlay, { opponents }) : copy.opponentTbd}
          </h2>
          <div className={styles.nextMeta}>
            <span>
              <Trophy aria-hidden="true" />
              {match.eventTitle} · {tournamentRound(locale, match.round)}
            </span>
            {match.court ? (
              <span>
                <MapPin aria-hidden="true" />
                {match.court.name}
                {match.court.location ? ` · ${match.court.location}` : ''}
              </span>
            ) : null}
            <span>
              <Clock aria-hidden="true" />
              {match.plannedStartAt
                ? formatDate(match.plannedStartAt, { dateStyle: 'medium', timeStyle: 'short' })
                : eventCopy.timeNotSet}
            </span>
          </div>
        </div>
        {live ? (
          <p className={styles.countdown} aria-label={`${yourScore}–${theirScore}`}>
            <span className={styles.countdownValue}>
              {yourScore}–{theirScore}
            </span>
            <span className={styles.countdownUnit}>{tournamentStatus(locale, match.status)}</span>
          </p>
        ) : null}
      </div>
      <div className={styles.entry}>
        <div className={styles.entryActions}>
          <Link href={`/dashboard/events/${match.eventId}`} className={outlineLinkClassName}>
            {copy.openEvent}
          </Link>
          <Link href={`/matches/${match.id}`} className={outlineLinkClassName}>
            {copy.openMatch}
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * The competitor's next event, carrying their own entry inside it. The two
 * questions a player opens this dashboard with — when do I play, and am I in —
 * are answered by one card rather than two that must be read together.
 */
export function PlayerNextEvent({
  event,
  entry,
  pairing,
  action,
  loading,
}: {
  event: EventDto | null;
  entry: RegistrationDto | null;
  /** Who the reader plays — see `pairingModel`. Drives the note; the client owns the buttons. */
  pairing?: PairingState;
  action?: ReactNode;
  loading: boolean;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].playerHome;
  const common = tournamentCopy[locale].common;

  if (!event) {
    return (
      <section className={styles.next} data-empty="true">
        <div className={styles.nextTop}>
          <div className={styles.nextCopy}>
            <p className={styles.nextKicker}>{copy.nextUp}</p>
            <h2 className={styles.nextTitle}>{loading ? common.loading : copy.noEvent}</h2>
            {loading ? null : <p className={styles.entryNote}>{copy.noEventDetail}</p>}
          </div>
        </div>
      </section>
    );
  }

  const remaining = daysUntil(event.date);
  const stage = entry ? entryStage(entry) : null;
  const pairingNote = pairing ? pairingNoteKey(pairing) : null;

  return (
    <section className={styles.next} aria-labelledby="player-next-event">
      <div className={styles.nextTop}>
        <div className={styles.nextCopy}>
          <p className={styles.nextKicker}>{copy.nextUp}</p>
          <h2 id="player-next-event" className={styles.nextTitle}>{event.title}</h2>
          <div className={styles.nextMeta}>
            <span>
              <CalendarDays aria-hidden="true" />
              {formatDate(event.date, { dateStyle: 'full', timeStyle: 'short' })}
            </span>
            <span>
              <MapPin aria-hidden="true" />
              {event.location}
            </span>
            {event.arrivalTime ? (
              <span>
                <Clock aria-hidden="true" />
                {copy.arrival} {formatDate(event.arrivalTime, { timeStyle: 'short' })}
              </span>
            ) : null}
            {event.categories.length ? (
              <span>
                <Tags aria-hidden="true" />
                {event.categories.map((category) => category.name).join(' · ')}
              </span>
            ) : null}
          </div>
        </div>
        <p className={styles.countdown}>
          {remaining > 1 ? (
            <>
              <span className={styles.countdownValue}>{remaining}</span>
              <span className={styles.countdownUnit}>{copy.days}</span>
            </>
          ) : (
            <span className={styles.countdownUnit}>
              {remaining === 1 ? copy.tomorrow : remaining === 0 ? copy.today : copy.underWay}
            </span>
          )}
        </p>
      </div>

      <div className={styles.entry}>
        <div className={styles.entryHead}>
          <p className={styles.entryLabel}>{copy.yourEntry}</p>
          <StatusLabel
            icon={
              stage?.kind === 'path' && stage.attention === 'NEEDS_CHANGES'
                ? 'warning'
                : stage?.kind === 'path' && stage.step >= 1
                  ? 'check'
                  : 'dot'
            }
          >
            {entry ? tournamentStatus(locale, entry.status) : copy.notEntered}
          </StatusLabel>
        </div>

        {stage?.kind === 'path' ? (
          <>
            <StageRail
              steps={entryPath.map((key, index): RailStep => ({
                key,
                label: copy[key],
                state: index < stage.step ? 'done' : index === stage.step ? 'current' : 'upcoming',
              }))}
            />
            <p className={styles.entryNote}>{entry ? copy[entryNoteKey(entry)] : null}</p>
          </>
        ) : (
          <p className={styles.entryNote}>{entry ? copy[entryNoteKey(entry)] : copy.notEnteredDetail}</p>
        )}

        {/* Who they play, when that is still an open question. The states the
            player can act on are said by their button instead. */}
        {pairingNote ? (
          <p className={styles.pairing}>
            <Handshake aria-hidden="true" />
            <span>
              {pairing?.kind === 'sent'
                ? fillTemplate(copy[pairingNote], { pair: pairing.opponent })
                : copy[pairingNote]}
            </span>
          </p>
        ) : null}

        <div className={styles.entryActions}>
          {action}
          <Link href={`/dashboard/events/${event.id}`} className={outlineLinkClassName}>
            {copy.openEvent}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Screen-reader label for the compact entry indicator used in the list below. */
export function entryStepLabel(registration: Pick<RegistrationDto, 'status' | 'inDraw'>, locale: 'en' | 'ka') {
  const copy = tournamentCopy[locale].playerHome;
  const step = entryStep(registration);
  if (step < 0) return tournamentStatus(locale, registration.status);
  return fillTemplate(copy.stepOf, {
    current: step + 1,
    total: entryPath.length,
    label: copy[entryPath[step]!],
  });
}

export { entryPath, entryStage, entryStep, entryNoteKey } from './entryStatusModel';
