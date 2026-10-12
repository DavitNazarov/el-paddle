'use client';

import type { ReactNode } from 'react';
import { CalendarClock, MapPin, Tags } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import type { EventDto } from '@/types/admin';
import styles from './EventWorkspace.module.css';

/** The only forward path through an event, in the order the rail draws it. */
export const lifecycleOrder = ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED'] as const;

type EventCopy = (typeof tournamentCopy)['en' | 'ka']['admin']['event'];

function stageHelp(status: EventDto['status'], copy: EventCopy) {
  if (status === 'REGISTRATION_OPEN') return copy.registrationOpenHelp;
  if (status === 'REGISTRATION_CLOSED') return copy.registrationClosedHelp;
  if (status === 'ONGOING') return copy.ongoingHelp;
  return copy.completedHelp;
}

/**
 * Which event this is, how far it has got, and the one move that takes it
 * forward.
 *
 * The lifecycle is drawn once. It used to be stated three times over — a
 * numbered ring, a rail, and the stage name in a heading — which is three ways
 * of saying "2 of 4" and no way of saying what to do about it. The rail alone
 * carries it: every stage is named, the current one is marked in words as well
 * as in weight, and the single legal forward move sits beside it.
 */
export function EventHeaderBand({ event, action }: { event: EventDto; action?: ReactNode }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].admin.event;
  const common = tournamentCopy[locale].common;
  const currentIndex = lifecycleOrder.indexOf(event.status);

  return (
    <section className={styles.band} aria-labelledby="event-stage">
      <div className={styles.bandMeta}>
        <span className={styles.metaItem}>
          <CalendarClock aria-hidden="true" />
          {formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
        <span className={styles.metaItem}>
          <MapPin aria-hidden="true" />
          <span className="sr-only">{common.location}: </span>
          {event.location}
        </span>
        {event.categories.length ? (
          <span className={styles.metaItem}>
            <Tags aria-hidden="true" />
            <span className="sr-only">{common.categories}: </span>
            {event.categories.map((category) => category.name).join(' · ')}
          </span>
        ) : null}
      </div>

      <div className={styles.bandMain}>
        <ol className={styles.rail} aria-label={fillTemplate(copy.stageOf, { current: currentIndex + 1, total: lifecycleOrder.length })}>
          {lifecycleOrder.map((stage, index) => {
            const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
            return (
              <li key={stage} className={styles.railStep} data-state={state}>
                <span className={styles.railMark} aria-hidden="true" />
                <span className={styles.railLabel}>
                  {index === currentIndex ? (
                    <span id="event-stage" className={styles.railCurrent}>
                      {tournamentStatus(locale, stage)}
                      <span className={styles.railNow}>{copy.currentStage}</span>
                    </span>
                  ) : (
                    tournamentStatus(locale, stage)
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        {action ? <div className={styles.bandAction}>{action}</div> : null}
      </div>

      <p className={styles.bandHelp}>{stageHelp(event.status, copy)}</p>
    </section>
  );
}
