'use client';

import { Check, Minus, Plus, Undo2 } from 'lucide-react';
import type { MatchDto } from '@/types/tournament';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import {
  SIDES,
  canAddPoint,
  canRecordSlot,
  canSubtractPoint,
  canUndo,
  currentSlotNumber,
  isLive,
  pairName,
  participantOf,
  slotProgress,
  tallyOf,
  type Side,
} from './matchModel';
import styles from './Match.module.css';

/**
 * The slot band. A judge interrupted mid-match comes back to this line first,
 * so it answers "which slot are we on" as a headline number rather than a
 * label, and the dots show the shape of the whole match beside it.
 */
export function SlotBand({ match }: { match: MatchDto }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].judge.match;
  const progress = slotProgress(match);
  const live = isLive(match);
  const current = currentSlotNumber(match);

  return (
    <div className={styles.band} data-live={live}>
      <p className={styles.bandSlot}>
        {live ? (
          <>
            {copy.slotWord}
            <span className={styles.bandNumber}>{current}</span>
            {fillTemplate(copy.slotOfMax, { max: progress.max })}
          </>
        ) : (
          copy.awaitingStart
        )}
      </p>
      <ul className={styles.bandDots} aria-hidden="true">
        {Array.from({ length: progress.max }, (_, index) => (
          <li
            key={index}
            className={styles.bandDot}
            data-state={index < progress.played ? 'played' : index === progress.played && live ? 'current' : 'upcoming'}
          />
        ))}
      </ul>
      <p className={styles.bandTarget}>{fillTemplate(copy.firstTo, { count: progress.winsNeeded })}</p>
    </div>
  );
}

/**
 * One side. The pair name is the largest type on the page — larger than the
 * score — because it is the thing being checked against the people on court.
 */
function SideCard({
  match,
  side,
  busy,
  children,
}: {
  match: MatchDto;
  side: Side;
  busy: string;
  children: React.ReactNode;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const judge = copy.judge.match;
  const entry = participantOf(match, side);
  const tally = tallyOf(match, side);
  const other = tallyOf(match, side === 'A' ? 'B' : 'A');

  return (
    <section className={styles.side} data-leading={tally > other} aria-label={side === 'A' ? copy.common.sideA : copy.common.sideB}>
      <div className={styles.sideHead}>
        <span className={styles.sideTag}>{side}</span>
        <p className={styles.sideLabel}>{side === 'A' ? copy.common.sideA : copy.common.sideB}</p>
      </div>
      <h2 className={styles.pair} data-pending={!entry}>
        {pairName(entry, judge.participantPending)}
      </h2>
      <div className={styles.tally}>
        <span className={styles.tallyValue} aria-live="polite">
          {tally}
        </span>
        <span className={styles.tallyLabel}>
          {match.scoringMode === 'SLOTS' ? judge.slotsWonLabel : judge.pointsLabel}
        </span>
      </div>
      {children}
      <span className="sr-only">{busy}</span>
    </section>
  );
}

/** Slot scoring: one button per side, and it opens a confirmation rather than recording. */
export function SlotSides({
  match,
  busy,
  onPick,
}: {
  match: MatchDto;
  busy: string;
  onPick: (side: Side, slotNumber: number) => void;
}) {
  const { locale } = useI18n();
  const judge = tournamentCopy[locale].judge.match;
  const current = currentSlotNumber(match);
  const recordable = canRecordSlot(match);

  return (
    <div className={styles.sides}>
      {SIDES.map((side) => (
        <SideCard key={side} match={match} side={side} busy="">
          <button
            type="button"
            className={styles.record}
            disabled={!recordable || busy === 'slot'}
            onClick={() => onPick(side, current)}
          >
            {fillTemplate(judge.sideWonSlot, { side, number: current })}
          </button>
        </SideCard>
      ))}
    </div>
  );
}

/** Points scoring, kept for historical matches that predate slots. */
export function PointSides({
  match,
  busy,
  onScore,
}: {
  match: MatchDto;
  busy: string;
  onScore: (side: Side, action: 'INCREMENT' | 'DECREMENT') => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const judge = copy.judge.match;

  return (
    <div className={styles.sides}>
      {SIDES.map((side) => {
        const label = side === 'A' ? copy.common.sideA : copy.common.sideB;
        return (
          <SideCard key={side} match={match} side={side} busy="">
            <div className={styles.points}>
              <button
                type="button"
                className={styles.pointButton}
                aria-label={fillTemplate(judge.subtractLabel, { side: label })}
                disabled={!canSubtractPoint(match, side) || busy.includes('DECREMENT')}
                onClick={() => onScore(side, 'DECREMENT')}
              >
                <Minus aria-hidden="true" />
                {judge.subtract}
              </button>
              <button
                type="button"
                className={styles.pointButton}
                data-tone="primary"
                aria-label={fillTemplate(judge.addLabel, { side: label })}
                disabled={!canAddPoint(match, side) || busy.includes('INCREMENT')}
                onClick={() => onScore(side, 'INCREMENT')}
              >
                <Plus aria-hidden="true" />
                {judge.add}
              </button>
            </div>
          </SideCard>
        );
      })}
    </div>
  );
}

/** What has been recorded, and the way back out of the last one. */
export function SlotHistory({ match, busy, onUndo }: { match: MatchDto; busy: string; onUndo: () => void }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const judge = copy.judge.match;
  if (!match.slots.length) return null;

  return (
    <div className={styles.history}>
      <span className={styles.historyLabel}>{judge.slotHistory}</span>
      <ul className={styles.historyList}>
        {match.slots.map((slot) => (
          <li key={slot.slotNumber} className={styles.historyChip}>
            {fillTemplate(judge.slotChip, { number: slot.slotNumber })}
            <span aria-hidden="true">·</span>
            {slot.winnerSide === 'A' ? copy.common.sideA : copy.common.sideB}
          </li>
        ))}
      </ul>
      {canUndo(match) ? (
        <button type="button" className={styles.undo} disabled={busy === 'undo'} onClick={onUndo}>
          <Undo2 aria-hidden="true" />
          {judge.undo}
        </button>
      ) : null}
    </div>
  );
}

export function MatchComplete({ children }: { children?: React.ReactNode }) {
  const { locale } = useI18n();
  const judge = tournamentCopy[locale].judge.match;
  return (
    <div className={styles.done}>
      <p className={styles.doneText} role="status">
        <Check aria-hidden="true" />
        {judge.complete}
      </p>
      {children}
    </div>
  );
}

export const consoleClassName = styles.console;
export const startPanelClassName = styles.start;
export const confirmBodyClassName = styles.confirmBody;
export const confirmScoreClassName = styles.confirmScore;
