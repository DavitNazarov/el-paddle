'use client';

import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, Lock, Trash2 } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CourtDto, ScheduleItemDto } from '@/types/tournament';
import { QueueMeter } from '@/components/shared/dashboard/DashboardSignals';
import { selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import {
  courtProgress,
  firstMovablePosition,
  isFrozen,
  isQueueFinished,
  matchPair,
  matchTitle,
  queueDroppableId,
} from './scheduleModel';
import styles from './Schedule.module.css';

export type CourtHandlers = {
  onMoveToCourt: (item: ScheduleItemDto, targetCourtId: string) => void;
  onNudge: (court: CourtDto, item: ScheduleItemDto, delta: number) => void;
  onUnschedule: (item: ScheduleItemDto) => void;
};

/**
 * The one court that is open. Only a single queue is ever expanded, so the page
 * stays the same length whether the event runs on two courts or ten, and the
 * long list belongs to the court the operator actually chose.
 */
export function CourtDetail({
  busy,
  court,
  courts,
  locked,
  onStep,
  ...handlers
}: CourtHandlers & {
  busy: string;
  court: CourtDto;
  courts: CourtDto[];
  locked: boolean;
  /** Moves to the previous/next court without going back up to the board. */
  onStep: (delta: number) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const finished = isQueueFinished(court);
  const progress = courtProgress(court);
  const { setNodeRef, isOver } = useDroppable({ id: queueDroppableId(court.id), disabled: locked || finished });
  const itemIds = court.scheduleItems.map((item) => item.id);
  const index = courts.findIndex((candidate) => candidate.id === court.id);

  return (
    <section className={styles.detail} data-over={isOver} aria-labelledby={`court-${court.id}`}>
      <header className={styles.detailHead}>
        <div className={styles.detailIdentity}>
          <h3 id={`court-${court.id}`} className={styles.detailName}>
            {fillTemplate(copy.queueTitle, { court: court.name })}
          </h3>
          <p className={styles.detailPlace}>
            {court.location ? `${court.location} · ` : ''}
            {fillTemplate(copy.queueOf, { index: index + 1, total: courts.length })}
          </p>
        </div>
        <div className={styles.detailNav}>
          {finished ? <span className={styles.finishedChip}>{copy.queueFinished}</span> : null}
          {courts.length > 1 ? (
            <>
              <button type="button" className={styles.iconButton} aria-label={copy.previousCourt} onClick={() => onStep(-1)}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className={styles.iconButton} aria-label={copy.nextCourt} onClick={() => onStep(1)}>
                <ChevronRight aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className={styles.detailBody}>
        {court.scheduleItems.length ? (
          <QueueMeter
            label={copy.queueProgress}
            done={progress.done}
            total={progress.total}
            valueLabel={fillTemplate(copy.ofTotal, { done: progress.done, total: progress.total })}
          />
        ) : null}
      </div>

      <div ref={setNodeRef} className={styles.courtQueue}>
        {court.scheduleItems.length ? (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <ol className={styles.queueList}>
              {court.scheduleItems.map((item, itemIndex) => (
                <QueueRow
                  key={item.id}
                  busy={busy}
                  court={court}
                  courts={courts}
                  index={itemIndex}
                  item={item}
                  locked={locked || finished}
                  onMoveToCourt={handlers.onMoveToCourt}
                  onNudge={handlers.onNudge}
                  onUnschedule={handlers.onUnschedule}
                  total={court.scheduleItems.length}
                />
              ))}
            </ol>
          </SortableContext>
        ) : (
          <p className={styles.courtEmpty}>{locked ? copy.emptyQueue : copy.emptyQueueDetail}</p>
        )}
      </div>

      {locked ? null : <p className={styles.detailHint}>{copy.detailHint}</p>}
    </section>
  );
}

function QueueRow({
  busy,
  court,
  courts,
  index,
  item,
  locked,
  onMoveToCourt,
  onNudge,
  onUnschedule,
  total,
}: {
  busy: string;
  court: CourtDto;
  courts: CourtDto[];
  index: number;
  item: ScheduleItemDto;
  locked: boolean;
  onMoveToCourt: (item: ScheduleItemDto, targetCourtId: string) => void;
  onNudge: (court: CourtDto, item: ScheduleItemDto, delta: number) => void;
  onUnschedule: (item: ScheduleItemDto) => void;
  total: number;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const frozen = isFrozen(item);
  const movable = !locked && !frozen;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !movable });
  const lowestPosition = firstMovablePosition(court.scheduleItems);
  const otherCourts = courts.filter((candidate) => candidate.id !== court.id && !isQueueFinished(candidate));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={styles.queueRow}
      data-dragging={isDragging}
      data-status={item.status.toLowerCase()}
    >
      <div className={styles.rowMain}>
        {movable ? (
          <button
            type="button"
            className={styles.grip}
            aria-label={fillTemplate(copy.dragHandle, { number: item.match.matchNumber })}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" />
          </button>
        ) : (
          <span className={styles.grip} data-frozen="true">
            <Lock aria-hidden="true" />
            <span className="sr-only">{copy.frozenItem}</span>
          </span>
        )}
        <span className={styles.position} data-first={index === 0}>{item.queuePosition}</span>
        <div className={styles.rowText}>
          <p className={styles.rowTitle}>{matchTitle(locale, item.match)}</p>
          <p className={styles.rowPair}>{matchPair(locale, item.match)}</p>
        </div>
        <ScheduleStatusPill status={item.status} />
      </div>

      <div className={styles.rowFoot}>
        <span className={styles.rowTime}>
          <CalendarClock aria-hidden="true" />
          {item.plannedStartAt ? formatDate(item.plannedStartAt, { hour: 'numeric', minute: '2-digit' }) : copy.timeNotSet}
        </span>
        {movable ? (
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={fillTemplate(copy.moveUp, { number: item.match.matchNumber, court: court.name })}
              disabled={item.queuePosition <= lowestPosition || busy === `reorder-${court.id}`}
              onClick={() => onNudge(court, item, -1)}
            >
              <ChevronUp aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={fillTemplate(copy.moveDown, { number: item.match.matchNumber, court: court.name })}
              disabled={index >= total - 1 || busy === `reorder-${court.id}`}
              onClick={() => onNudge(court, item, 1)}
            >
              <ChevronDown aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              data-danger="true"
              aria-label={fillTemplate(copy.removeItemLabel, { number: item.match.matchNumber })}
              disabled={busy === `remove-${item.id}`}
              onClick={() => onUnschedule(item)}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Its own row: a court name is far too wide to sit beside the nudge buttons. */}
      {movable && otherCourts.length ? (
        <select
          className={`${selectControlClassName} ${styles.moveSelect} h-11 bg-white text-xs`}
          aria-label={fillTemplate(copy.moveToCourtLabel, { number: item.match.matchNumber })}
          value=""
          disabled={busy === `move-${item.id}`}
          onChange={(fieldEvent) => { if (fieldEvent.target.value) onMoveToCourt(item, fieldEvent.target.value); }}
        >
          <option value="">{copy.moveToCourt}</option>
          {otherCourts.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
      ) : null}
    </li>
  );
}

export function ScheduleStatusPill({ status }: { status: ScheduleItemDto['status'] }) {
  const { locale } = useI18n();
  return <span className={styles.statusPill} data-status={status.toLowerCase()}>{tournamentStatus(locale, status)}</span>;
}
