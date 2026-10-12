'use client';

import type { ReactNode } from 'react';
import { CalendarClock, Eye, EyeOff, MapPin } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { EventDto } from '@/types/admin';
import type { DaySummary } from './scheduleModel';
import styles from './Schedule.module.css';

type ScheduleCopy = (typeof tournamentCopy)['en' | 'ka']['admin']['schedule'];

/**
 * Whether this day is ready to run, in one sentence.
 *
 * Two progress bars reported how much of the day was placed and how much was
 * played, and left the reader to decide whether that was good. Only one of
 * those readings is ever a problem — a match with nowhere to be played — so
 * that is the sentence, and the rest is the progress behind it.
 */
function readiness(summary: DaySummary, copy: ScheduleCopy) {
  if (summary.courtCount === 0) return copy.dayNoCourts;
  if (summary.placed + summary.unscheduled === 0) return copy.dayNoMatches;
  if (summary.unscheduled > 0) {
    return summary.unscheduled === 1
      ? copy.dayUnscheduledOne
      : fillTemplate(copy.dayUnscheduledMany, { count: summary.unscheduled });
  }
  return fillTemplate(copy.dayReady, { courts: summary.courtCount, placed: summary.placed });
}

export function ScheduleDayHeader({
  event,
  summary,
  action,
}: {
  event: EventDto | null;
  summary: DaySummary;
  /** The publish/unpublish command, owned by the client. */
  action?: ReactNode;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const common = tournamentCopy[locale].common;
  const needsAttention = summary.courtCount > 0 && summary.unscheduled > 0;

  return (
    <section className={styles.day} aria-label={copy.overview}>
      <div className={styles.dayMeta}>
        <span className={styles.dayMetaItem}>
          <CalendarClock aria-hidden="true" />
          {event ? formatDate(event.date, { weekday: 'long', day: 'numeric', month: 'long' }) : common.loading}
        </span>
        {event ? (
          <span className={styles.dayMetaItem}>
            <MapPin aria-hidden="true" />
            {event.location}
          </span>
        ) : null}
        <span className={styles.publicChip} data-live={summary.published}>
          {summary.published ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          {summary.published ? copy.visiblePlayers : copy.adminsOnly}
        </span>
      </div>

      <div className={styles.dayMain}>
        <p className={styles.dayState} data-attention={needsAttention}>
          {readiness(summary, copy)}
          {summary.placed > 0 ? (
            <span className={styles.dayProgress}>
              {fillTemplate(copy.dayProgress, { done: summary.settled, placed: summary.placed })}
            </span>
          ) : null}
        </p>
        {action}
      </div>
    </section>
  );
}
