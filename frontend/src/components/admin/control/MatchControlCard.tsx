'use client';

import { useState } from 'react';
import { CalendarClock, Check, MapPin, Radio, Trophy } from 'lucide-react';
import type { MatchDto } from '@/types/tournament';
import { CommandButton, StatusLabel } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';
import { canEditTime, courtOf, fromLocalInputValue, plannedStartOf, toLocalInputValue } from './controlModel';
import {
  SIDES,
  canFinishEarly,
  canRecordResult,
  canStart,
  clubNameOf,
  emptyResultDraft,
  pairName,
  participantOf,
  readResult,
  setProgress,
  tallyOf,
  usesSets,
  type ResultDraft,
} from './matchModel';
import { finishedTallyExample } from './setEngine';
import styles from './MatchControl.module.css';

export type CardHandlers = {
  onStart: (match: MatchDto) => void;
  onRecordResult: (match: MatchDto, setsA: number, setsB: number) => void;
  onFinish: (match: MatchDto) => void;
  onSaveTime: (match: MatchDto, isoOrNull: string | null) => void;
};

/**
 * One match, told in the order an operator reads it: where and when it is, who
 * is on court and for which club, how the sets stand, and only then the controls.
 * The two pair names carry the largest type because they are what the operator
 * checks against the four people in front of them.
 */
export function MatchControlCard({
  busy,
  locked,
  match,
  ...handlers
}: CardHandlers & {
  busy: string;
  locked: boolean;
  match: MatchDto;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const control = copy.admin.control;
  const court = courtOf(match);
  const progress = setProgress(match);
  const live = match.status === 'IN_PROGRESS';
  const completed = match.status === 'COMPLETED';

  return (
    <article className={styles.card} data-live={live} data-complete={completed}>
      <header className={styles.cardHead}>
        <span className={styles.cardNumber}>
          {tournamentRound(locale, match.round)} · {copy.common.match} {match.matchNumber}
        </span>
        <StatusLabel icon={live ? 'dot' : completed ? 'check' : 'dot'}>
          {tournamentStatus(locale, match.status)}
        </StatusLabel>
      </header>

      <div className={styles.cardWhere}>
        <span className={styles.cardCourt} data-missing={!court}>
          <MapPin aria-hidden="true" />
          {court ? court.name : control.noCourt}
        </span>
        <TimeField
          busy={busy}
          locked={locked}
          match={match}
          onSave={handlers.onSaveTime}
          value={plannedStartOf(match)}
          formatted={plannedStartOf(match) ? formatDate(plannedStartOf(match)!, { hour: 'numeric', minute: '2-digit' }) : ''}
        />
      </div>

      <ol className={styles.sides}>
        {SIDES.map((side) => (
          <li key={side} className={styles.side} data-winner={completed && match.winnerEntryId === participantOf(match, side)?.id}>
            <span className={styles.sideMarker} aria-hidden="true">{side}</span>
            <span className={styles.sideNames}>{pairName(participantOf(match, side), copy.common.tbd)}</span>
            <span className={styles.sideClub}>{clubNameOf(match, side) || control.clubUnknown}</span>
            <span className={styles.sideTally}>{tallyOf(match, side)}</span>
          </li>
        ))}
      </ol>

      {usesSets(match) ? (
        <p className={styles.setsRow}>
          <span className={styles.setsLabel}>{control.setsLabel}</span>
          {/* The tally beside each pair is the score; this row only says what race it is being run to. */}
          <span className={styles.setsFormat}>{fillTemplate(control.bestOf, { count: progress.winsNeeded })}</span>
        </p>
      ) : null}

      {locked ? null : (
        <div className={styles.actions}>
          {canStart(match) ? (
            <CommandButton
              tone="primary"
              className={styles.actionButton}
              busy={busy === `start-${match.id}`}
              onClick={() => handlers.onStart(match)}
            >
              <Radio aria-hidden="true" />
              {control.start}
            </CommandButton>
          ) : null}

          {match.status === 'READY' && !match.scheduleItem ? (
            <p className={styles.actionHint}>{control.noCourtHint}</p>
          ) : null}

          {canRecordResult(match) ? (
            <ResultField busy={busy === `result-${match.id}`} match={match} onSubmit={handlers.onRecordResult} />
          ) : null}

          {canFinishEarly(match) ? (
            <CommandButton className={styles.actionGhost} onClick={() => handlers.onFinish(match)}>
              {control.finish}
            </CommandButton>
          ) : null}

          {completed ? (
            <p className={styles.actionDone}>
              {match.nextMatchId ? <Trophy aria-hidden="true" /> : <Check aria-hidden="true" />}
              {match.nextMatchId ? control.winnerAdvances : control.completed}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}

/**
 * The result, written the way it is heard: two numbers. An operator is told
 * "one two", not who took which set, so the console asks once for the final set
 * tally and the server derives the sets it is made of. The submit stays off
 * until the pair of numbers is a result the server would accept, so a half-typed
 * tally can never reach it.
 */
function ResultField({
  busy,
  match,
  onSubmit,
}: {
  busy: boolean;
  match: MatchDto;
  onSubmit: (match: MatchDto, setsA: number, setsB: number) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const control = copy.admin.control;
  const [draft, setDraft] = useState<ResultDraft>(emptyResultDraft);
  const reading = readResult(match, draft);
  const winsNeeded = setProgress(match).winsNeeded;

  return (
    <form
      className={styles.resultForm}
      onSubmit={(formEvent) => {
        formEvent.preventDefault();
        if (reading.finished && !reading.regresses) onSubmit(match, reading.a, reading.b);
      }}
    >
      <div className={styles.resultRow}>
        {SIDES.map((side) => (
          <label key={side} className={styles.resultField}>
            <span className="sr-only">
              {fillTemplate(control.resultFieldLabel, { pair: pairName(participantOf(match, side), copy.common.tbd) })}
            </span>
            <span className={styles.resultSide} aria-hidden="true">{side}</span>
            <input
              type="number"
              inputMode="numeric"
              className={styles.resultInput}
              min={0}
              max={winsNeeded}
              placeholder="0"
              disabled={busy}
              value={draft[side]}
              onChange={(fieldEvent) => setDraft((current) => ({ ...current, [side]: fieldEvent.target.value }))}
            />
          </label>
        ))}
        <CommandButton
          type="submit"
          tone="primary"
          className={styles.resultSubmit}
          busy={busy}
          disabled={!reading.finished || reading.regresses}
        >
          {control.recordResult}
        </CommandButton>
      </div>
      <p className={styles.resultHint}>
        {reading.regresses
          ? control.resultRegresses
          : fillTemplate(control.resultHint, { example: finishedTallyExample(winsNeeded) })}
      </p>
    </form>
  );
}

/**
 * The planned start, editable in place. The server freezes a started item, so
 * once a match is running this reads as text rather than offering a field the
 * server would refuse.
 */
function TimeField({
  busy,
  formatted,
  locked,
  match,
  onSave,
  value,
}: {
  busy: string;
  formatted: string;
  locked: boolean;
  match: MatchDto;
  onSave: (match: MatchDto, isoOrNull: string | null) => void;
  value: string | null;
}) {
  const { locale } = useI18n();
  const control = tournamentCopy[locale].admin.control;
  const [draft, setDraft] = useState<string | null>(null);
  const editable = !locked && canEditTime(match);

  if (!editable) {
    return (
      <span className={styles.cardTime} data-missing={!value}>
        <CalendarClock aria-hidden="true" />
        {formatted || control.timeNotSet}
      </span>
    );
  }

  return (
    <label className={styles.cardTimeEdit}>
      <CalendarClock aria-hidden="true" />
      <span className="sr-only">{fillTemplate(control.editTime, { number: match.matchNumber })}</span>
      <input
        type="datetime-local"
        className={styles.timeInput}
        disabled={busy === `time-${match.id}`}
        value={draft ?? toLocalInputValue(value)}
        onChange={(fieldEvent) => setDraft(fieldEvent.target.value)}
        onBlur={(fieldEvent) => {
          const next = fieldEvent.target.value;
          setDraft(null);
          if (next !== toLocalInputValue(value)) onSave(match, fromLocalInputValue(next));
        }}
      />
    </label>
  );
}
