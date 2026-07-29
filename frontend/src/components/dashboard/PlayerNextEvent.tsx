'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDays, Clock, MapPin, Tags } from 'lucide-react';
import { StageRail, type RailStep } from '@/components/shared/dashboard/DashboardSignals';
import { StatusLabel } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import type { EventDto, RegistrationDto } from '@/types/dashboard';
import styles from './PlayerHome.module.css';

/** Entry states that are still on the path to playing, in the order they happen. */
const entryPath = ['stepSubmitted', 'stepApproved', 'stepPlaying'] as const;

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

/**
 * How far along the entry path a registration has reached. Terminal states
 * (declined, withdrawn, cancelled) are deliberately not on the path: showing
 * them as progress would imply a place that does not exist.
 */
function entryStep(status: RegistrationDto['status']): number {
  if (status === 'APPROVED') return 1;
  if (status === 'PENDING' || status === 'NEEDS_CHANGES' || status === 'WAITLISTED') return 0;
  return -1;
}

/**
 * The competitor's next event, carrying their own entry inside it. The two
 * questions a player opens this dashboard with — when do I play, and am I in —
 * are answered by one card rather than two that must be read together.
 */
export function PlayerNextEvent({
  event,
  entry,
  action,
  loading,
}: {
  event: EventDto | null;
  entry: RegistrationDto | null;
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
  const step = entry ? entryStep(entry.status) : -1;

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
          <StatusLabel icon={entry?.status === 'APPROVED' ? 'check' : 'dot'}>
            {entry ? tournamentStatus(locale, entry.status) : copy.notEntered}
          </StatusLabel>
        </div>

        {step >= 0 ? (
          <>
            <StageRail
              steps={entryPath.map((key, index): RailStep => ({
                key,
                label: copy[key],
                state: index < step ? 'done' : index === step ? 'current' : 'upcoming',
              }))}
            />
            <p className={styles.entryNote}>{step === 0 ? copy.underReview : copy.approvedNote}</p>
          </>
        ) : (
          <p className={styles.entryNote}>{entry ? copy.blockedNote : copy.notEnteredDetail}</p>
        )}

        <div className={styles.entryActions}>
          {action}
          <Link
            href={`/dashboard/events/${event.id}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--dash-border)] px-4 text-sm font-semibold text-[var(--dash-text)] transition-colors hover:border-[var(--dash-border-strong)] hover:bg-[var(--dash-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]"
          >
            {copy.openEvent}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Screen-reader label for the compact entry indicator used in the list below. */
export function entryStepLabel(status: RegistrationDto['status'], locale: 'en' | 'ka') {
  const copy = tournamentCopy[locale].playerHome;
  const step = entryStep(status);
  if (step < 0) return tournamentStatus(locale, status);
  return fillTemplate(copy.stepOf, {
    current: step + 1,
    total: entryPath.length,
    label: copy[entryPath[step]!],
  });
}

export { entryStep, entryPath };
