'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  GripVertical,
  MoveVertical,
  Radio,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { BracketDto, MatchDto } from '@/types/tournament';
import { CommandButton } from '@/components/tournament/TournamentUI';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';
import {
  activeRounds,
  championEntryId,
  championPathMatchIds,
  effectiveSlotCount,
  pairLabel,
  slotKey,
  winnerSide,
  type PlacementSlot,
} from './bracketModel';
import styles from './BracketTree.module.css';

type TreeHandlers = {
  onMatchOverride: (match: MatchDto, slotCountOverride: number | null) => void;
  onMoveRequest: (slot: PlacementSlot) => void;
  onReopen: (match: MatchDto) => void;
  onRoundDefault: (bracket: BracketDto, round: MatchDto['round'], slotCount: number) => void;
};

/**
 * The draw as a tree, left to right. The champion's route is drawn as a spine
 * down the matches they won, so a finished draw reads as one path to the title
 * rather than a grid of unrelated results.
 */
export function BracketTree({
  bracket,
  busy,
  isCompleted,
  ...handlers
}: TreeHandlers & {
  bracket: BracketDto;
  busy: string;
  isCompleted: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const visibleRounds = activeRounds(bracket.matches);
  // Locking snapshots participant identity, so entries can only be rearranged while drafting.
  const placementEnabled = !isCompleted && bracket.status === 'DRAFT';
  const firstRoundMatches = bracket.matches.filter((match) => match.round === visibleRounds[0]);
  const rowCount = Math.max(firstRoundMatches.length * 2, 2);
  const championPath = championPathMatchIds(bracket);
  const champion = championEntryId(bracket);
  const boardStyle = {
    '--round-count': visibleRounds.length,
    '--row-count': rowCount,
  } as CSSProperties;

  return (
    <div className={styles.boardRegion}>
      <div className={styles.boardHint}>
        <span className={styles.hintTitle}>{copy.admin.bracket.progression}</span>
        <span className={styles.hintDetail}>
          {placementEnabled ? <GripVertical aria-hidden="true" /> : null}
          {placementEnabled ? copy.admin.bracket.dragHint : copy.admin.bracket.progressionDescription}
        </span>
        {championPath.size ? (
          <span className={styles.legend}>
            <span className={styles.legendSpine} aria-hidden="true" />
            <Trophy aria-hidden="true" />
            {copy.admin.bracket.championPath}
          </span>
        ) : null}
      </div>
      <div className={styles.board} style={boardStyle}>
        {visibleRounds.map((round, roundIndex) => {
          const roundMatches = bracket.matches
            .filter((match) => match.round === round)
            .sort((a, b) => a.roundPosition - b.roundPosition);
          const rowSpan = Math.max(2 ** (roundIndex + 1), 2);
          return (
            <section key={round} className={styles.round} aria-labelledby={`${bracket.id}-${round}`}>
              <header className={styles.roundHeader}>
                <span>{String(roundIndex + 1).padStart(2, '0')}</span>
                <h3 id={`${bracket.id}-${round}`}>{tournamentRound(locale, round)}</h3>
                <small>{roundMatches.length} {roundMatches.length === 1 ? copy.common.match.toLowerCase() : copy.common.matches}</small>
                {isCompleted ? null : (
                  <div className={cn(styles.slotControl, styles.roundSlotControl)}>
                    <label htmlFor={`${bracket.id}-${round}-slots`}>{copy.admin.bracket.slotsPerMatch}</label>
                    <select
                      id={`${bracket.id}-${round}-slots`}
                      value={bracket.slotDefaults[round] ?? 1}
                      disabled={busy === `slots-${bracket.id}-${round}`}
                      onChange={(fieldEvent) => handlers.onRoundDefault(bracket, round, Number(fieldEvent.target.value))}
                    >
                      <option value={1}>{copy.admin.bracket.slotOption1}</option>
                      <option value={2}>{copy.admin.bracket.slotOption2}</option>
                      <option value={3}>{copy.admin.bracket.slotOption3}</option>
                    </select>
                  </div>
                )}
              </header>
              <div className={styles.roundMatches}>
                {roundMatches.map((match, matchIndex) => {
                  const slotStyle = {
                    gridRow: `${matchIndex * rowSpan + 1} / span ${rowSpan}`,
                  } as CSSProperties;
                  return (
                    <div
                      key={match.id}
                      className={cn(styles.matchSlot, roundIndex < visibleRounds.length - 1 && styles.matchAdvances)}
                      style={slotStyle}
                      data-champion={championPath.has(match.id)}
                    >
                      <MatchCard
                        bracket={bracket}
                        busy={busy}
                        championEntry={champion}
                        isCompleted={isCompleted}
                        isFinal={round === 'FINAL'}
                        match={match}
                        onChampionPath={championPath.has(match.id)}
                        onMatchOverride={handlers.onMatchOverride}
                        onMoveRequest={handlers.onMoveRequest}
                        onReopen={handlers.onReopen}
                        placementEnabled={placementEnabled && round === visibleRounds[0]}
                      />
                      {roundIndex < visibleRounds.length - 1 ? <ChevronRight className={styles.advanceIcon} aria-hidden="true" /> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({
  bracket,
  busy,
  championEntry,
  isCompleted,
  isFinal,
  match,
  onChampionPath,
  onMatchOverride,
  onMoveRequest,
  onReopen,
  placementEnabled,
}: {
  bracket: BracketDto;
  busy: string;
  championEntry: string | null;
  isCompleted: boolean;
  isFinal: boolean;
  match: MatchDto;
  onChampionPath: boolean;
  onMatchOverride: (match: MatchDto, slotCountOverride: number | null) => void;
  onMoveRequest: (slot: PlacementSlot) => void;
  onReopen: (match: MatchDto) => void;
  placementEnabled: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const winner = winnerSide(match);
  const slotsUsed = match.scoringMode === 'SLOTS';
  // Once a match starts its format is frozen server-side, so the select gives way to a badge.
  const formatEditable = slotsUsed && !isCompleted && !match.startedAt && (match.status === 'PENDING' || match.status === 'READY');
  const roundDefault = bracket.slotDefaults[match.round] ?? 1;
  // Only a normally scored slot match can be walked back; walkovers go through corrections.
  const canReopen = slotsUsed && !isCompleted && match.status === 'COMPLETED' && match.resultType === 'NORMAL' && match.slots.length > 0;

  return (
    <article
      className={styles.matchCard}
      data-status={match.status.toLowerCase()}
      data-champion={onChampionPath}
      aria-label={`${copy.common.match} ${match.matchNumber}, ${tournamentStatus(locale, match.status)}`}
    >
      <header className={styles.matchHeader}>
        <span>{copy.common.match} {match.matchNumber}</span>
        <MatchStatus status={match.status} />
      </header>
      <div className={styles.participants}>
        {(['A', 'B'] as const).map((side) => {
          const entryId = side === 'A' ? match.participantAEntryId : match.participantBEntryId;
          return (
            <ParticipantRow
              key={side}
              busy={busy}
              champion={isFinal && Boolean(championEntry) && entryId === championEntry}
              hasEntry={Boolean(entryId)}
              label={pairLabel(bracket, match, side, locale)}
              onMoveRequest={onMoveRequest}
              placementEnabled={placementEnabled}
              score={match.status === 'COMPLETED' ? (side === 'A' ? match.scoreA : match.scoreB) : null}
              side={side}
              slot={{ bracketId: bracket.id, matchId: match.id, side }}
              winner={winner === side}
            />
          );
        })}
      </div>
      {slotsUsed ? (
        <div className={styles.matchFormat}>
          {formatEditable ? (
            <div className={styles.slotControl}>
              <label className="sr-only" htmlFor={`${match.id}-slots`}>{copy.admin.bracket.matchSlots}</label>
              <select
                id={`${match.id}-slots`}
                value={match.slotCountOverride ?? ''}
                disabled={busy === `slots-match-${match.id}`}
                onChange={(fieldEvent) => onMatchOverride(match, fieldEvent.target.value === '' ? null : Number(fieldEvent.target.value))}
              >
                <option value="">{fillTemplate(copy.admin.bracket.slotDefaultOption, { count: roundDefault })}</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          ) : (
            <span className={styles.formatBadge}>{fillTemplate(copy.admin.bracket.slotBadge, { count: effectiveSlotCount(bracket, match) })}</span>
          )}
          {match.slots.length && match.resultType !== 'ADMIN_DECISION' ? (
            <ul className={styles.slotChips} aria-label={copy.admin.bracket.matchSlots}>
              {match.slots.map((slot) => (
                <li key={slot.slotNumber}>
                  {fillTemplate(copy.publicEvent.slotShort, { number: slot.slotNumber })}
                  <span aria-hidden="true">·</span>
                  {slot.winnerSide}
                </li>
              ))}
            </ul>
          ) : null}
          {canReopen ? (
            <CommandButton className="min-h-11" busy={busy === `reopen-${match.id}`} onClick={() => onReopen(match)}>
              <RotateCcw aria-hidden="true" />
              {copy.admin.bracket.reopenMatch}
            </CommandButton>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ParticipantRow({
  busy,
  champion,
  hasEntry,
  label,
  onMoveRequest,
  placementEnabled,
  score,
  side,
  slot,
  winner,
}: {
  busy: string;
  champion: boolean;
  hasEntry: boolean;
  label: string;
  onMoveRequest: (slot: PlacementSlot) => void;
  placementEnabled: boolean;
  score: number | null;
  side: 'A' | 'B';
  slot: PlacementSlot;
  winner: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const pending = label === copy.publicEvent.toBeDetermined || label.includes(copy.common.winner);
  const key = slotKey(slot);
  const draggable = placementEnabled && hasEntry;
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: key, data: { bracketId: slot.bracketId }, disabled: !draggable });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: key, data: { bracketId: slot.bracketId }, disabled: !placementEnabled });

  return (
    <div
      ref={setDropRef}
      className={cn(
        styles.participant,
        winner && styles.winner,
        champion && styles.championRow,
        pending && styles.pendingParticipant,
        isOver && styles.dropTarget,
        isDragging && styles.dragging,
      )}
    >
      <span className={styles.sideLabel}>{side}</span>
      {draggable ? (
        <button
          type="button"
          ref={setDragRef}
          className={styles.pairHandle}
          aria-label={fillTemplate(copy.admin.bracket.moveEntryTitle, { pair: label })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className={styles.grip} aria-hidden="true" />
          <span className={styles.pairName}>{label}</span>
        </button>
      ) : (
        <span className={styles.pairName}>{label}</span>
      )}
      {champion ? (
        <span className={styles.championMark}>
          <Trophy aria-hidden="true" />
          <span className="sr-only">{copy.admin.bracket.champion}</span>
        </span>
      ) : null}
      {winner && !champion ? <Check className={styles.winnerCheck} aria-label={copy.common.winner} /> : null}
      {draggable ? (
        <button
          type="button"
          className={styles.moveButton}
          aria-label={fillTemplate(copy.admin.bracket.moveEntryTitle, { pair: label })}
          disabled={busy === `place-${key}`}
          onClick={() => onMoveRequest(slot)}
        >
          <MoveVertical aria-hidden="true" />
        </button>
      ) : null}
      <span className={styles.score}>{score ?? '—'}</span>
    </div>
  );
}

function MatchStatus({ status }: { status: MatchDto['status'] }) {
  const { locale } = useI18n();
  const icons: Record<MatchDto['status'], ReactNode> = {
    COMPLETED: <CheckCircle2 aria-hidden="true" />,
    IN_PROGRESS: <Radio aria-hidden="true" />,
    READY: <CircleDot aria-hidden="true" />,
    PENDING: <Clock3 aria-hidden="true" />,
    CANCELLED: <XCircle aria-hidden="true" />,
  };
  return (
    <span className={styles.matchStatus} data-status={status.toLowerCase()}>
      {icons[status]}
      {tournamentStatus(locale, status)}
    </span>
  );
}
