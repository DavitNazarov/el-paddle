'use client';

import type { ReactNode } from 'react';
import { CalendarClock, Eye, EyeOff, MapPin } from 'lucide-react';
import { QueueMeter } from '@/components/shared/dashboard/DashboardSignals';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { EventDto } from '@/types/admin';
import type { DaySummary } from './scheduleModel';
import styles from './Schedule.module.css';

/**
 * The day, first. A schedule reader arrives asking "is this day ready to run?",
 * which is three readings — courts staffed, matches placed, matches played —
 * and one state: whether players can see any of it yet.
 */
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
  const totalMatches = summary.placed + summary.unscheduled;

  return (
    <section className={styles.day} aria-label={copy.overview}>
      <div className={styles.dayTop}>
        <span className={styles.dayIcon}>
          <CalendarClock aria-hidden="true" />
        </span>
        <div className={styles.dayCopy}>
          <p className={styles.dayEyebrow}>{copy.eventDay}</p>
          <h2 className={styles.dayDate}>
            {event ? formatDate(event.date, { weekday: 'long', month: 'long', day: 'numeric' }) : common.loading}
          </h2>
          {event ? (
            <p className={styles.dayPlace}>
              <MapPin aria-hidden="true" />
              {event.location}
            </p>
          ) : null}
        </div>
        <div className={styles.dayAside}>
          <span className={styles.publicChip} data-live={summary.published}>
            {summary.published ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            {summary.published ? copy.visiblePlayers : copy.adminsOnly}
          </span>
          {action}
        </div>
      </div>

      <div className={styles.dayMeters}>
        <QueueMeter
          label={copy.courtsStaffed}
          done={summary.staffedCourts}
          total={summary.courtCount}
          valueLabel={summary.courtCount
            ? fillTemplate(copy.ofTotal, { done: summary.staffedCourts, total: summary.courtCount })
            : copy.createToBegin}
        />
        <QueueMeter
          label={copy.matchesPlaced}
          done={summary.placed}
          total={totalMatches}
          valueLabel={totalMatches
            ? fillTemplate(copy.ofTotal, { done: summary.placed, total: totalMatches })
            : copy.noMatchesYet}
        />
        <QueueMeter
          label={copy.matchesSettled}
          done={summary.settled}
          total={summary.placed}
          valueLabel={summary.placed
            ? fillTemplate(copy.ofTotal, { done: summary.settled, total: summary.placed })
            : copy.noMatchesYet}
        />
      </div>
    </section>
  );
}
