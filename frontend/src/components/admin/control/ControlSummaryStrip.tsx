'use client';

import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import type { ControlFilters } from './controlFilters';
import type { ControlSummary } from './runBoard';
import styles from './MatchControl.module.css';

/**
 * The day in five numbers — and each one is the way into the matches behind it.
 * A count an operator cannot act on is a count they have to translate into a
 * search, so every tile here narrows the console instead of merely reporting.
 */
export function ControlSummaryStrip({
  filters,
  onFilter,
  onShowCourts,
  summary,
}: {
  filters: ControlFilters;
  onFilter: (patch: Partial<ControlFilters>) => void;
  onShowCourts: () => void;
  summary: ControlSummary;
}) {
  const { locale } = useI18n();
  const control = tournamentCopy[locale].admin.control;

  const tiles: Array<{
    key: string;
    label: string;
    value: number | string;
    tone?: string;
    /** Null for a tile that goes somewhere rather than toggling a filter. */
    active: boolean | null;
    onClick: () => void;
  }> = [
    {
      key: 'live',
      label: control.live,
      value: summary.live,
      tone: summary.live ? 'live' : undefined,
      active: filters.band === 'live',
      onClick: () => onFilter({ band: filters.band === 'live' ? null : 'live' }),
    },
    {
      key: 'ready',
      label: control.readyCount,
      value: summary.ready,
      active: filters.band === 'ready',
      onClick: () => onFilter({ band: filters.band === 'ready' ? null : 'ready' }),
    },
    {
      // Not a filter but a destination: "which courts are standing idle" is a
      // question only the lanes can answer, so this tile goes there.
      key: 'courts',
      label: control.courtsOpen,
      value: `${summary.courtsOpen}/${summary.courtsOpen + summary.courtsLive}`,
      tone: summary.courtsOpen ? 'attention' : undefined,
      active: null,
      onClick: onShowCourts,
    },
    {
      key: 'behind',
      label: control.behind,
      value: summary.behind,
      tone: summary.behind ? 'attention' : undefined,
      active: filters.late,
      onClick: () => onFilter({ late: !filters.late }),
    },
    {
      key: 'played',
      label: control.played,
      value: `${summary.completed}/${summary.total}`,
      active: filters.band === 'done',
      onClick: () => onFilter({ band: filters.band === 'done' ? null : 'done' }),
    },
  ];

  return (
    <div className={styles.summary} role="group" aria-label={control.summaryLabel}>
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          className={styles.metric}
          data-tone={tile.tone}
          data-active={tile.active === true}
          aria-pressed={tile.active ?? undefined}
          onClick={tile.onClick}
        >
          <span className={styles.metricValue}>{tile.value}</span>
          <span className={styles.metricLabel}>{tile.label}</span>
        </button>
      ))}
    </div>
  );
}
