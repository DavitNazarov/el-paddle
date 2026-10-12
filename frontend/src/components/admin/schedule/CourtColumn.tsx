'use client';

import { Check, Clock, Inbox, Radio, type LucideIcon } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { CourtDto, ScheduleItemDto } from '@/types/tournament';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { QueueCard } from './QueueCard';
import {
  courtDroppableId,
  courtProgress,
  courtState,
  isQueueFinished,
  type CategoryNamer,
  type CourtState,
} from './scheduleModel';
import styles from './Schedule.module.css';

const stateIcons: Record<CourtState, LucideIcon> = {
  done: Check,
  live: Radio,
  idle: Inbox,
  ready: Clock,
};

/**
 * One court, as the column of matches it will actually play.
 *
 * The board used to be a grid of summary tiles with one court's queue expanded
 * underneath, which meant scheduling was done a court at a time: pick a tile,
 * scroll to the panel, drag into it, repeat. Nothing showed two queues beside
 * each other, so the one judgement this screen exists for — is this court
 * carrying twice as much as that one — could not be made at all.
 *
 * A column shows its whole queue, and the columns sit side by side, so a match
 * is moved between courts by dragging it there.
 */
export function CourtColumn({
  busy,
  categoryOf,
  court,
  courts,
  locked,
  onMoveToCourt,
  onNudge,
  onUnschedule,
}: {
  busy: string;
  categoryOf: CategoryNamer;
  court: CourtDto;
  courts: CourtDto[];
  locked: boolean;
  onMoveToCourt: (item: ScheduleItemDto, targetCourtId: string) => void;
  onNudge: (court: CourtDto, item: ScheduleItemDto, delta: number) => void;
  onUnschedule: (item: ScheduleItemDto) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const finished = isQueueFinished(court);
  const state = courtState(court);
  const StateIcon = stateIcons[state];
  const progress = courtProgress(court);
  const { setNodeRef, isOver } = useDroppable({ id: courtDroppableId(court.id), disabled: locked || finished });
  const itemIds = court.scheduleItems.map((item) => item.id);

  const stateLabel = {
    done: copy.stateDone,
    live: copy.stateLive,
    idle: copy.stateIdle,
    ready: copy.stateReady,
  }[state];

  return (
    <section
      className={styles.column}
      data-over={isOver}
      data-state={state}
      aria-labelledby={`court-${court.id}`}
    >
      <header className={styles.columnHead}>
        <h3 id={`court-${court.id}`} className={styles.columnName}>{court.name}</h3>
        <span className={styles.columnState} data-state={state}>
          <StateIcon aria-hidden="true" />
          {stateLabel}
        </span>
        <p className={styles.columnCount}>
          {progress.total
            ? fillTemplate(copy.ofTotal, { done: progress.done, total: progress.total })
            : copy.noMatchesYet}
        </p>
      </header>

      <div ref={setNodeRef} className={styles.columnBody}>
        {court.scheduleItems.length ? (
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <ol className={styles.cardList}>
              {court.scheduleItems.map((item) => (
                <QueueCard
                  key={item.id}
                  busy={busy}
                  categoryOf={categoryOf}
                  court={court}
                  courts={courts}
                  item={item}
                  locked={locked}
                  onMoveToCourt={onMoveToCourt}
                  onNudge={onNudge}
                  onUnschedule={onUnschedule}
                />
              ))}
            </ol>
          </SortableContext>
        ) : (
          <p className={styles.columnEmpty}>{locked ? copy.emptyQueue : copy.emptyQueueDetail}</p>
        )}
      </div>
    </section>
  );
}
