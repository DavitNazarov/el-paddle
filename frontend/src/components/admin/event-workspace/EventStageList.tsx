'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, ClipboardList, GitBranch, Radio, Swords, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { EventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
import type { EventDto } from '@/types/admin';
import styles from './EventWorkspace.module.css';

/**
 * The five screens an event is run from, each stating where it stands.
 *
 * These were five cards carrying a sentence of instruction each — "Review,
 * approve, and publish the teams entered in this event" — which is a manual, and
 * a manual is read once. What an operator needs on returning is the count: eight
 * approved, three waiting. So each row is its live state and nothing else, and
 * the rows are a list rather than a grid because they are read in order.
 */

type Stage = {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Live state, or null while the counts are still arriving. */
  state: string | null;
  /** The reader is not allowed to see this stage's counts. */
  unavailable: boolean;
  href: string;
  /** This stage is holding a queue only a decision can clear. */
  waiting: boolean;
};

export function EventStageList({ event, signals }: { event: EventDto; signals: EventWorkspaceSignals }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.event;
  const base = `/admin/events/${event.id}`;
  // A finished event's open queues are history, not a request for a decision.
  const actionable = event.status !== 'COMPLETED';

  const stages: Stage[] = [
    {
      key: 'registrations',
      icon: ClipboardList,
      label: copy.registrations,
      state: signals.registrations
        ? signals.registrations.approved + signals.registrations.pending === 0
          ? copy.registrationsEmpty
          : fillTemplate(copy.registrationsSignal, signals.registrations)
        : null,
      unavailable: signals.registrations === null,
      href: `${base}/registrations`,
      waiting: actionable && (signals.registrations?.pending ?? 0) > 0,
    },
    {
      key: 'requests',
      icon: Swords,
      label: copy.requests,
      state: signals.requests
        ? signals.requests.total === 0
          ? copy.requestsEmpty
          : fillTemplate(copy.requestsSignal, signals.requests)
        : null,
      unavailable: signals.requests === null,
      href: `${base}/opponent-requests`,
      waiting: actionable && (signals.requests?.awaiting ?? 0) > 0,
    },
    {
      key: 'bracket',
      icon: GitBranch,
      label: copy.bracket,
      state: signals.brackets
        ? signals.brackets.total === 0
          ? copy.bracketEmpty
          : fillTemplate(copy.bracketSignal, signals.brackets)
        : null,
      unavailable: signals.brackets === null,
      href: `${base}/bracket`,
      waiting: false,
    },
    {
      key: 'schedule',
      icon: CalendarClock,
      label: copy.schedule,
      state: signals.schedule
        ? signals.schedule.courts === 0
          ? copy.scheduleEmpty
          : fillTemplate(copy.scheduleSignal, signals.schedule)
        : null,
      unavailable: signals.schedule === null,
      href: `${base}/schedule`,
      waiting: false,
    },
    {
      key: 'control',
      icon: Radio,
      label: copy.control,
      state: signals.control
        ? signals.control.live + signals.control.ready === 0
          ? copy.controlEmpty
          : fillTemplate(copy.controlSignal, signals.control)
        : null,
      unavailable: signals.control === null,
      href: `${base}/control`,
      waiting: actionable && event.status === 'ONGOING' && (signals.control?.ready ?? 0) > 0,
    },
  ];

  return (
    <section className={styles.panel} aria-labelledby="event-stages">
      <h2 id="event-stages" className={styles.panelTitle}>{copy.stagesTitle}</h2>
      <ul className={styles.stageList}>
        {stages.map((stage) => (
          <li key={stage.key}>
            <Link className={styles.stageRow} href={stage.href} data-waiting={stage.waiting}>
              <span className={styles.stageIcon} aria-hidden="true"><stage.icon /></span>
              <span className={styles.stageLabel}>{stage.label}</span>
              <span className={styles.stageState} data-quiet={stage.unavailable}>
                {/* A refused read is a missing number, never "nothing waiting". */}
                {stage.unavailable ? copy.signalUnavailable : stage.state ?? copy.loadingSignal}
              </span>
              <span className={styles.stageOpen}>
                <span className="sr-only">{copy.openStage}</span>
                <ArrowRight aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
