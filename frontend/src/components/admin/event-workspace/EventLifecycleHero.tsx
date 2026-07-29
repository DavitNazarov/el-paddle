'use client';

import type { ReactNode } from 'react';
import { Clock, MapPin, Tags } from 'lucide-react';
import { StageRail, type RailStep } from '@/components/shared/dashboard/DashboardSignals';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import type { EventDto } from '@/types/admin';
import styles from './EventWorkspace.module.css';

/** The only forward path through an event, in the order the rail draws it. */
export const lifecycleOrder = ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED'] as const;

type EventCopy = typeof tournamentCopy.en.admin.event | typeof tournamentCopy.ka.admin.event;

function stageHelp(status: EventDto['status'], copy: EventCopy) {
  if (status === 'REGISTRATION_OPEN') return copy.registrationOpenHelp;
  if (status === 'REGISTRATION_CLOSED') return copy.registrationClosedHelp;
  if (status === 'ONGOING') return copy.ongoingHelp;
  return copy.completedHelp;
}

/**
 * Progress read before colour: the stage number sits inside the arc, so the
 * ring is a reinforcement of "stage 2 of 4" rather than the only signal.
 */
function StageRing({ stage, total }: { stage: number; total: number }) {
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 48 48" className={styles.ring} aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r={radius} className={styles.ringTrack} />
      <circle
        cx="24"
        cy="24"
        r={radius}
        className={styles.ringFill}
        style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - stage / total) }}
      />
      <text x="24" y="24" className={styles.ringText}>
        {stage}
      </text>
    </svg>
  );
}

/**
 * Event identity, lifecycle rail, and the single forward action, in one card.
 * The rail replaces the previous one-line status because the allowed moves are
 * a fixed sequence — showing the whole sequence explains where "next" leads.
 */
export function EventLifecycleHero({ event, action }: { event: EventDto; action?: ReactNode }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].admin.event;
  const common = tournamentCopy[locale].common;
  const currentIndex = lifecycleOrder.indexOf(event.status);

  return (
    <section className={styles.hero} aria-labelledby="event-lifecycle-stage">
      <div className={styles.heroTop}>
        <div className={styles.heroIdentity}>
          <StageRing stage={currentIndex + 1} total={lifecycleOrder.length} />
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>
              {fillTemplate(copy.stageOf, { current: currentIndex + 1, total: lifecycleOrder.length })}
            </p>
            <h2 id="event-lifecycle-stage" className={styles.heroStage}>
              {tournamentStatus(locale, event.status)}
            </h2>
            <p className={styles.heroHelp}>{stageHelp(event.status, copy)}</p>
          </div>
        </div>
        {action ? <div className={styles.heroActions}>{action}</div> : null}
      </div>

      <StageRail className={styles.heroRail} steps={lifecycleOrder.map((stage, index): RailStep => ({
        key: stage,
        label: tournamentStatus(locale, stage),
        state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming',
        note: index === currentIndex ? copy.currentStage : undefined,
      }))} />

      <div className={styles.heroMeta}>
        <span className={styles.metaItem}>
          <Clock aria-hidden="true" />
          <span className="sr-only">{copy.eventDate}: </span>
          <span className={styles.metaValue}>{formatDate(event.date, { dateStyle: 'long', timeStyle: 'short' })}</span>
        </span>
        <span className={styles.metaItem}>
          <MapPin aria-hidden="true" />
          <span className="sr-only">{common.location}: </span>
          <span className={styles.metaValue}>{event.location}</span>
        </span>
        <span className={styles.metaItem}>
          <Tags aria-hidden="true" />
          <span className="sr-only">{common.categories}: </span>
          <span className={styles.metaValue}>{event.categories.map((category) => category.name).join(' · ')}</span>
        </span>
      </div>
    </section>
  );
}
