'use client';

import { GripVertical, Inbox } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { CourtDto, MatchDto } from '@/types/tournament';
import { selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import {
  POOL_DROPPABLE_ID,
  isQueueFinished,
  matchPair,
  matchTitle,
  poolItemId,
  type CategoryNamer,
} from './scheduleModel';
import styles from './Schedule.module.css';

/**
 * Matches that belong to a draw but sit in no court queue yet.
 *
 * The first column on the board, because it is the one everything is dragged
 * out of. It is also a drop target, so a match dragged back here comes off the
 * schedule rather than needing a separate remove trip.
 */
export function UnscheduledPool({
  busy,
  categoryOf,
  courts,
  locked,
  matches,
  onPlace,
}: {
  busy: string;
  categoryOf: CategoryNamer;
  courts: CourtDto[];
  locked: boolean;
  matches: MatchDto[];
  onPlace: (matchId: string, courtId: string) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const { setNodeRef, isOver } = useDroppable({ id: POOL_DROPPABLE_ID, disabled: locked });
  const openCourts = courts.filter((court) => !isQueueFinished(court));

  return (
    <section className={styles.column} data-pool="true" data-over={isOver} aria-labelledby="unscheduled-pool">
      <header className={styles.columnHead}>
        <h3 id="unscheduled-pool" className={styles.columnName}>{copy.unscheduledTitle}</h3>
        <span className={styles.columnState} data-state={matches.length ? 'idle' : 'done'}>
          <Inbox aria-hidden="true" />
          {fillTemplate(copy.matchesCount, { count: matches.length })}
        </span>
        <p className={styles.columnCount}>{locked ? '' : copy.unscheduledDetail}</p>
      </header>

      <div ref={setNodeRef} className={styles.columnBody}>
        {matches.length ? (
          <ul className={styles.cardList}>
            {matches.map((match) => (
              <PoolCard
                key={match.id}
                busy={busy}
                category={categoryOf(match)}
                courts={openCourts}
                locked={locked}
                match={match}
                onPlace={onPlace}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.columnEmpty}>{copy.poolEmptyDetail}</p>
        )}
      </div>
    </section>
  );
}

function PoolCard({
  busy,
  category,
  courts,
  locked,
  match,
  onPlace,
}: {
  busy: string;
  category: string;
  courts: CourtDto[];
  locked: boolean;
  match: MatchDto;
  onPlace: (matchId: string, courtId: string) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const draggable = !locked && courts.length > 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: poolItemId(match.id),
    disabled: !draggable,
  });

  return (
    <li ref={setNodeRef} className={styles.card} data-dragging={isDragging} data-pool="true">
      <div className={styles.cardTop}>
        <div className={styles.cardText}>
          {/* The category leads: it is what tells two "Match 3"s apart. */}
          {category ? <p className={styles.cardCategory}>{category}</p> : null}
          <p className={styles.cardTitle}>{matchTitle(locale, match)}</p>
          <p className={styles.cardPair}>{matchPair(locale, match)}</p>
        </div>

        {draggable ? (
          <button
            type="button"
            className={styles.cardGrip}
            aria-label={fillTemplate(copy.dragToCourt, { number: match.matchNumber })}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Keyboard and touch path for the same move the drag performs. */}
      {draggable ? (
        <select
          className={`${selectControlClassName} ${styles.cardMove}`}
          aria-label={fillTemplate(copy.placeOnCourtLabel, { number: match.matchNumber })}
          value=""
          disabled={busy === `place-${match.id}`}
          onChange={(fieldEvent) => { if (fieldEvent.target.value) onPlace(match.id, fieldEvent.target.value); }}
        >
          <option value="">{copy.placeOnCourt}</option>
          {courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
        </select>
      ) : null}
    </li>
  );
}
