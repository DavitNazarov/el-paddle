'use client';

import { Check, Clock, Inbox, Radio, TriangleAlert, UserRound, type LucideIcon } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import type { CourtDto } from '@/types/tournament';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import {
  courtDroppableId,
  courtFocus,
  courtNeedsAttention,
  courtProgress,
  courtState,
  isQueueFinished,
  judgeName,
  matchTitle,
  type CourtState,
} from './scheduleModel';
import styles from './Schedule.module.css';

/**
 * Every court at once. The old board gave each court a full column, so eight
 * courts with a dozen matches each ran to several screens and the one question
 * an operator arrives with — which court needs me? — could not be answered
 * without scrolling past everything that did not. A tile is fixed height: state,
 * judge, progress, and the two matches worth naming. The queue itself belongs
 * to whichever court is open below.
 */
export function CourtBoard({
  courts,
  selectedCourtId,
  onSelect,
}: {
  courts: CourtDto[];
  selectedCourtId: string | null;
  onSelect: (courtId: string) => void;
}) {
  return (
    <ul className={styles.board}>
      {courts.map((court) => (
        <CourtTile
          key={court.id}
          court={court}
          selected={court.id === selectedCourtId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

const stateIcons: Record<CourtState, LucideIcon> = {
  done: Check,
  live: Radio,
  unstaffed: TriangleAlert,
  idle: Inbox,
  ready: Clock,
};

function CourtTile({
  court,
  selected,
  onSelect,
}: {
  court: CourtDto;
  selected: boolean;
  onSelect: (courtId: string) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const state = courtState(court);
  const StateIcon = stateIcons[state];
  const progress = courtProgress(court);
  const focus = courtFocus(court);
  const judge = court.judgeAssignments[0]?.judge;
  const { setNodeRef, isOver } = useDroppable({ id: courtDroppableId(court.id), disabled: isQueueFinished(court) });
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const stateLabel = {
    done: copy.stateDone,
    live: copy.stateLive,
    unstaffed: copy.stateUnstaffed,
    idle: copy.stateIdle,
    ready: copy.stateReady,
  }[state];

  return (
    <li
      ref={setNodeRef}
      className={styles.tile}
      data-over={isOver}
      data-selected={selected}
      data-attention={courtNeedsAttention(state)}
    >
      <div className={styles.tileHead}>
        <h3 className={styles.tileName}>{court.name}</h3>
        <span className={styles.tileState} data-state={state}>
          <StateIcon aria-hidden="true" />
          {stateLabel}
        </span>
      </div>

      <p className={styles.tileMeta}>
        <span className={styles.tileJudge} data-missing={!judge}>
          <UserRound aria-hidden="true" />
          {judge ? judgeName(judge) : copy.noJudge}
        </span>
        <span className={styles.tileCounts}>
          {progress.total ? fillTemplate(copy.ofTotal, { done: progress.done, total: progress.total }) : copy.noMatchesYet}
          {focus.waiting ? ` · ${fillTemplate(copy.waitingCount, { count: focus.waiting })}` : ''}
        </span>
      </p>

      <div className={styles.tileBar} data-empty={progress.total === 0}>
        <span className={styles.tileBarFill} data-complete={progress.total > 0 && progress.done >= progress.total} style={{ width: `${percent}%` }} />
      </div>

      <div className={styles.tileFoot}>
        <div className={styles.tileFocus}>
          {focus.live ? (
            <p className={styles.tileMatch} data-live="true">
              <span className={styles.tileMatchLabel}>{copy.onCourt}</span>
              <span className={styles.tileMatchName}>{matchTitle(locale, focus.live.match)}</span>
            </p>
          ) : null}
          {focus.next ? (
            <p className={styles.tileMatch}>
              <span className={styles.tileMatchLabel}>{copy.upNext}</span>
              <span className={styles.tileMatchName}>{matchTitle(locale, focus.next.match)}</span>
            </p>
          ) : null}
          {focus.live || focus.next ? null : (
            <p className={styles.tileMatch} data-quiet="true">
              {state === 'done' ? copy.queueFinished : copy.tileEmptyHint}
            </p>
          )}
        </div>

        {/* Stretched control: the whole tile is clickable, but only this carries the name. */}
        <button
          type="button"
          className={styles.tileOpen}
          aria-pressed={selected}
          onClick={() => onSelect(court.id)}
        >
          {selected ? copy.selectedCourt : copy.openCourt}
          <span className="sr-only"> — {fillTemplate(copy.openCourtLabel, { court: court.name })}</span>
        </button>
      </div>
    </li>
  );
}
