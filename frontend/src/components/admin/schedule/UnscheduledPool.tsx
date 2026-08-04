'use client';

import { GripVertical, Inbox } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { CourtDto, MatchDto } from '@/types/tournament';
import { EmptyTournamentState, TournamentPanel, TournamentSectionHeader, StatusLabel } from '@/components/tournament/TournamentUI';
import { selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { POOL_DROPPABLE_ID, isQueueFinished, matchPair, matchTitle, poolItemId } from './scheduleModel';
import styles from './Schedule.module.css';

/**
 * Matches that exist in a draw but are not on any court yet. It used to be a
 * number in a metric tile and a dropdown inside a modal, which hid the one
 * question the operator has left: what still has nowhere to be played?
 *
 * It is also a drop target, so a match dragged out of a queue lands back here
 * rather than needing a separate "remove" trip.
 */
export function UnscheduledPool({
  busy,
  courts,
  locked,
  matches,
  onPlace,
}: {
  busy: string;
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
    <TournamentPanel className="border-[var(--dash-border)] bg-white" labelledBy="unscheduled-pool">
      <TournamentSectionHeader
        id="unscheduled-pool"
        title={copy.unscheduledTitle}
        description={locked ? undefined : copy.unscheduledDetail}
        actions={matches.length ? <StatusLabel>{fillTemplate(copy.matchesCount, { count: matches.length })}</StatusLabel> : undefined}
      />
      <div ref={setNodeRef} className={styles.pool} data-over={isOver}>
        {matches.length ? (
          <ul className={styles.poolList}>
            {matches.map((match) => (
              <PoolCard
                key={match.id}
                busy={busy}
                courts={openCourts}
                locked={locked}
                match={match}
                onPlace={onPlace}
              />
            ))}
          </ul>
        ) : (
          <EmptyTournamentState title={copy.poolEmpty} detail={copy.poolEmptyDetail} />
        )}
      </div>
    </TournamentPanel>
  );
}

function PoolCard({
  busy,
  courts,
  locked,
  match,
  onPlace,
}: {
  busy: string;
  courts: CourtDto[];
  locked: boolean;
  match: MatchDto;
  onPlace: (matchId: string, courtId: string) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const draggable = !locked && courts.length > 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: poolItemId(match.id), disabled: !draggable });

  return (
    <li ref={setNodeRef} className={styles.poolCard} data-dragging={isDragging}>
      <div className={styles.poolCardTop}>
        {draggable ? (
          <button
            type="button"
            className={styles.grip}
            aria-label={fillTemplate(copy.dragToCourt, { number: match.matchNumber })}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" />
          </button>
        ) : (
          <span className={styles.grip} data-frozen="true"><Inbox aria-hidden="true" /></span>
        )}
        <div className={styles.rowText}>
          <p className={styles.rowTitle}>{matchTitle(locale, match)}</p>
          <p className={styles.rowPair}>{matchPair(locale, match)}</p>
        </div>
      </div>
      {/* Keyboard and touch path for the same move the drag performs. */}
      {draggable ? (
        <select
          className={`${selectControlClassName} h-11 bg-white text-xs`}
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
