'use client';

import { CalendarClock, GripVertical, Lock, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CourtDto, ScheduleItemDto } from '@/types/tournament';
import { selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import {
  firstMovablePosition,
  isFrozen,
  isQueueFinished,
  matchPair,
  matchTitle,
  type CategoryNamer,
} from './scheduleModel';
import styles from './Schedule.module.css';

/**
 * One match in a court's queue.
 *
 * A card, not a row: the board reads across several queues at once, so what
 * matters is that a match can be picked up and dropped somewhere else. Its
 * position in the queue leads, because the queue order is the thing being
 * decided here — everything else on the card is what makes the match
 * identifiable while it is being moved.
 *
 * A started or finished match is pinned by the server. It keeps its place in
 * the column and says so with a lock rather than offering controls that would
 * be refused.
 */
export function QueueCard({
  busy,
  categoryOf,
  court,
  courts,
  item,
  locked,
  onMoveToCourt,
  onNudge,
  onUnschedule,
}: {
  busy: string;
  categoryOf: CategoryNamer;
  court: CourtDto;
  courts: CourtDto[];
  item: ScheduleItemDto;
  locked: boolean;
  onMoveToCourt: (item: ScheduleItemDto, targetCourtId: string) => void;
  onNudge: (court: CourtDto, item: ScheduleItemDto, delta: number) => void;
  onUnschedule: (item: ScheduleItemDto) => void;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const frozen = isFrozen(item);
  const movable = !locked && !frozen;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !movable,
  });
  const category = categoryOf(item.match);
  const others = courts.filter((candidate) => candidate.id !== court.id && !isQueueFinished(candidate));
  const settled = item.status === 'COMPLETED' || item.status === 'CANCELLED';
  // Nothing may be moved above the last started or finished match, and nothing
  // moves past the end of the queue — so the nudge that would be refused is off
  // rather than offered.
  const canMoveUp = item.queuePosition > firstMovablePosition(court.scheduleItems);
  const canMoveDown = item.queuePosition < court.scheduleItems.length;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={styles.card}
      data-dragging={isDragging}
      data-status={item.status.toLowerCase()}
    >
      <div className={styles.cardTop}>
        <span className={styles.cardPosition}>{item.queuePosition}</span>

        <div className={styles.cardText}>
          {category ? <p className={styles.cardCategory}>{category}</p> : null}
          <p className={styles.cardTitle}>{matchTitle(locale, item.match)}</p>
          <p className={styles.cardPair}>{matchPair(locale, item.match)}</p>
        </div>

        {movable ? (
          <button
            type="button"
            className={styles.cardGrip}
            aria-label={fillTemplate(copy.dragHandle, { number: item.match.matchNumber })}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" />
          </button>
        ) : (
          <span className={styles.cardGrip} data-frozen="true">
            <Lock aria-hidden="true" />
            <span className="sr-only">{copy.frozenItem}</span>
          </span>
        )}
      </div>

      <div className={styles.cardFoot}>
        <span className={styles.cardTime} data-set={Boolean(item.plannedStartAt)}>
          <CalendarClock aria-hidden="true" />
          {item.plannedStartAt
            ? formatDate(item.plannedStartAt, { hour: 'numeric', minute: '2-digit' })
            : copy.timeNotSet}
        </span>

        {/* The state is only worth a word once it is no longer just "queued". */}
        {item.status !== 'READY' && item.status !== 'TENTATIVE' ? (
          <span className={styles.cardStatus} data-settled={settled}>
            {tournamentStatus(locale, item.status)}
          </span>
        ) : null}

        {movable ? (
          <div className={styles.cardActions}>
            {/* Keyboard and touch path for the same moves the drag performs. */}
            <button
              type="button"
              className={styles.cardIcon}
              aria-label={fillTemplate(copy.moveUp, { number: item.match.matchNumber, court: court.name })}
              disabled={!canMoveUp || busy === `reorder-${court.id}`}
              onClick={() => onNudge(court, item, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className={styles.cardIcon}
              aria-label={fillTemplate(copy.moveDown, { number: item.match.matchNumber, court: court.name })}
              disabled={!canMoveDown || busy === `reorder-${court.id}`}
              onClick={() => onNudge(court, item, 1)}
            >
              ↓
            </button>
            {others.length ? (
              <select
                className={`${selectControlClassName} ${styles.cardMove}`}
                aria-label={fillTemplate(copy.moveToCourtLabel, { number: item.match.matchNumber })}
                value=""
                disabled={busy === `move-${item.id}`}
                onChange={(fieldEvent) => { if (fieldEvent.target.value) onMoveToCourt(item, fieldEvent.target.value); }}
              >
                <option value="">{copy.moveToCourt}</option>
                {others.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className={styles.cardIcon}
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
    </li>
  );
}
