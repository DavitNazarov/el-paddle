'use client';

import Link from 'next/link';
import { useI18n } from '@/components/shared/I18nProvider';
import { CommandButton } from '@/components/tournament/TournamentUI';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { EventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
import type { EventDto } from '@/types/admin';
import styles from './EventWorkspace.module.css';

export type PublicationField = 'publicLiveScoringEnabled' | 'resultsPublished';

/**
 * What the public can see, in five lines.
 *
 * The five surfaces publish independently, so stating only the two switches this
 * screen owns would imply the other three follow them. Each one is named with
 * its state; the three that are published from the screen that produces them say
 * so with a link, rather than growing a second switch here for the same command.
 */

type Row = {
  key: string;
  label: string;
  hint: string;
  live: boolean;
  /** Set when this surface is published from a different screen. */
  manageHref?: string;
  toggle?: { field: PublicationField; label: string };
};

export function EventPublicationList({
  event,
  signals,
  busy,
  onToggle,
}: {
  event: EventDto;
  signals: EventWorkspaceSignals;
  busy: boolean;
  onToggle: (field: PublicationField, next: boolean) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.event;
  const locked = event.status === 'COMPLETED';
  const base = `/admin/events/${event.id}`;
  const draws = signals.brackets;

  const rows: Row[] = [
    {
      key: 'roster',
      label: copy.registrations,
      hint: copy.rosterPublicHint,
      live: Boolean(event.registrationRosterPublishedAt),
      manageHref: `${base}/registrations`,
    },
    {
      key: 'bracket',
      label: copy.bracket,
      hint: draws?.total ? fillTemplate(copy.bracketSignal, draws) : copy.drawPublicHint,
      live: Boolean(draws?.published),
      manageHref: `${base}/bracket`,
    },
    {
      key: 'schedule',
      label: copy.schedule,
      hint: copy.schedulePublicHint,
      live: Boolean(event.schedulePublishedAt),
      manageHref: `${base}/schedule`,
    },
    {
      key: 'scores',
      label: copy.liveScoresLabel,
      hint: copy.scoresPublicHint,
      live: event.publicLiveScoringEnabled,
      toggle: {
        field: 'publicLiveScoringEnabled',
        label: event.publicLiveScoringEnabled ? copy.hideScores : copy.publishScores,
      },
    },
    {
      key: 'results',
      label: copy.finalResultsLabel,
      hint: copy.resultsPublicHint,
      live: Boolean(event.resultsPublishedAt),
      toggle: {
        field: 'resultsPublished',
        label: event.resultsPublishedAt ? copy.hideResults : copy.publishResults,
      },
    },
  ];

  return (
    <section className={styles.panel} aria-labelledby="event-publication">
      <div className={styles.panelHead}>
        <h2 id="event-publication" className={styles.panelTitle}>{copy.visibilityTitle}</h2>
        <p className={styles.panelHint}>{locked ? copy.publicationLocked : copy.publicationHint}</p>
      </div>
      <ul className={styles.publicList}>
        {rows.map((row) => (
          <li key={row.key} className={styles.publicRow}>
            <span className={styles.publicState} data-live={row.live}>
              <span className={styles.publicDot} aria-hidden="true" />
              {row.live ? copy.published : copy.hidden}
            </span>
            <span className={styles.publicText}>
              <span className={styles.publicLabel}>{row.label}</span>
              <span className={styles.publicHint}>{row.hint}</span>
            </span>
            {row.toggle ? (
              <CommandButton
                className={styles.publicAction}
                busy={busy}
                disabled={locked}
                onClick={() => onToggle(row.toggle!.field, !row.live)}
              >
                {row.toggle.label}
              </CommandButton>
            ) : (
              <Link className={styles.publicManage} href={row.manageHref!}>{copy.manage}</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
