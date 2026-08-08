'use client';

import Link from 'next/link';
import { CalendarClock, Lock, MapPin, Radio, Trophy, TriangleAlert } from 'lucide-react';
import type { MatchDto } from '@/types/tournament';
import { CommandButton, InlineNotice, StatusLabel } from '@/components/tournament/TournamentUI';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { useResetOnChange } from '@/hooks/useResetOnOpen';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';
import { canEditTime, fromLocalInputValue, toLocalInputValue } from './controlModel';
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
import type { ControlMatch } from './runBoard';
import styles from './MatchControl.module.css';

/**
 * The one place a match is acted on.
 *
 * Every view of the console is read-only, so the operator learns a single
 * surface for commands instead of meeting a different set of controls in each
 * list. It opens on the match they pointed at and answers, in order: where and
 * when it is, who is on court, how the sets stand, where the winner goes — and
 * only then what can be done about it.
 */

export type MatchSheetHandlers = {
  onStart: (match: MatchDto) => void;
  onRecordResult: (match: MatchDto, setsA: number, setsB: number) => void;
  onFinish: (match: MatchDto) => void;
  onSaveTime: (match: MatchDto, isoOrNull: string | null) => void;
};

export function MatchSheet({
  busy,
  entry,
  eventId,
  locked,
  nextMatch,
  onClose,
  ...handlers
}: MatchSheetHandlers & {
  busy: string;
  entry: ControlMatch | null;
  eventId: string;
  locked: boolean;
  nextMatch: ControlMatch | null;
  onClose: () => void;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const control = copy.admin.control;
  const match = entry?.match ?? null;

  return (
    <DashboardModal
      open={Boolean(entry)}
      onOpenChange={(open) => { if (!open && !busy) onClose(); }}
      title={match ? `${tournamentRound(locale, match.round)} · ${copy.common.match} ${match.matchNumber}` : ''}
      description={entry?.categoryName}
      size="lg"
    >
      {entry && match ? (
        <div className={styles.sheet}>
          <div className={styles.sheetStatus}>
            <StatusLabel icon={match.status === 'COMPLETED' ? 'check' : 'dot'}>
              {tournamentStatus(locale, match.status)}
            </StatusLabel>
            {entry.lateBy !== null ? (
              <span className={styles.sheetLate}>
                <TriangleAlert aria-hidden="true" />
                {fillTemplate(control.lateBy, { count: entry.lateBy })}
              </span>
            ) : null}
          </div>

          <section className={styles.sheetSection}>
            <h3 className={styles.sheetTitle}>{control.sheetWhere}</h3>
            <p className={styles.sheetWhere}>
              <span className={styles.sheetFact} data-missing={!entry.court}>
                <MapPin aria-hidden="true" />
                {entry.court ? entry.court.name : control.noCourt}
              </span>
              {entry.queuePosition ? (
                <span className={styles.sheetFact}>
                  {fillTemplate(control.queuePosition, { position: entry.queuePosition })}
                </span>
              ) : null}
              {entry.plannedStartAt ? (
                <span className={styles.sheetFact}>
                  <CalendarClock aria-hidden="true" />
                  {formatDate(entry.plannedStartAt, { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
            </p>
            <TimeField busy={busy} locked={locked} match={match} onSave={handlers.onSaveTime} />
            {entry.court ? null : (
              <p className={styles.sheetHint}>
                {control.noCourtHint}{' '}
                <Link className={styles.sheetLink} href={`/admin/events/${eventId}/schedule`}>{control.goToSchedule}</Link>
              </p>
            )}
          </section>

          <section className={styles.sheetSection}>
            <h3 className={styles.sheetTitle}>{control.sheetTeams}</h3>
            <ol className={styles.sides}>
              {SIDES.map((side) => (
                <li
                  key={side}
                  className={styles.side}
                  data-winner={match.status === 'COMPLETED' && match.winnerEntryId === participantOf(match, side)?.id}
                >
                  <span className={styles.sideMarker} aria-hidden="true">{side}</span>
                  <span className={styles.sideNames}>{pairName(participantOf(match, side), copy.common.tbd)}</span>
                  <span className={styles.sideClub}>{clubNameOf(match, side) || control.clubUnknown}</span>
                  <span className={styles.sideTally}>{tallyOf(match, side)}</span>
                </li>
              ))}
            </ol>
            {usesSets(match) ? <SetsStrip match={match} /> : null}
          </section>

          <section className={styles.sheetSection}>
            <h3 className={styles.sheetTitle}>{control.sheetFlow}</h3>
            <p className={styles.sheetFlow}>
              <Trophy aria-hidden="true" />
              {nextMatch
                ? fillTemplate(control.winnerToMatch, { number: nextMatch.match.matchNumber })
                : control.winnerIsChampion}
            </p>
            {match.resultReason ? (
              <p className={styles.sheetHint}>{match.resultReason}</p>
            ) : null}
          </section>

          {locked ? (
            <InlineNotice kind="info">{control.readOnly}</InlineNotice>
          ) : (
            <section className={styles.sheetActions}>
              <h3 className={styles.sheetTitle}>{control.sheetDo}</h3>

              {canStart(match) ? (
                <CommandButton
                  tone="primary"
                  className={styles.sheetPrimary}
                  busy={busy === `start-${match.id}`}
                  onClick={() => handlers.onStart(match)}
                >
                  <Radio aria-hidden="true" />
                  {control.start}
                </CommandButton>
              ) : null}

              {canRecordResult(match) ? (
                <ResultField busy={busy === `result-${match.id}`} match={match} onSubmit={handlers.onRecordResult} />
              ) : null}

              {match.status === 'PENDING' ? <p className={styles.sheetHint}>{control.awaitingPlayers}</p> : null}
              {match.status === 'COMPLETED' ? <p className={styles.sheetHint}>{control.completedHint}</p> : null}

              {canFinishEarly(match) ? (
                <CommandButton className={styles.sheetGhost} onClick={() => handlers.onFinish(match)}>
                  {control.finish}
                </CommandButton>
              ) : null}
            </section>
          )}
        </div>
      ) : null}
    </DashboardModal>
  );
}

/** The sets already decided, in the order they were played. */
function SetsStrip({ match }: { match: MatchDto }) {
  const { locale } = useI18n();
  const control = tournamentCopy[locale].admin.control;
  const progress = setProgress(match);

  return (
    <div className={styles.setsRow}>
      <span className={styles.setsLabel}>{control.setsLabel}</span>
      {match.sets.length ? (
        <ol className={styles.setChips}>
          {[...match.sets].sort((left, right) => left.setNumber - right.setNumber).map((set) => (
            <li key={set.setNumber} className={styles.setChip}>
              {fillTemplate(control.setWonBy, { number: set.setNumber, side: set.winnerSide })}
            </li>
          ))}
        </ol>
      ) : (
        <span className={styles.setChipEmpty}>{control.noSetsYet}</span>
      )}
      <span className={styles.setsFormat}>{fillTemplate(control.bestOf, { count: progress.winsNeeded })}</span>
    </div>
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
  // A different match reuses this form, and the last one's numbers must not be
  // its opening bid.
  const [draft, setDraft] = useResetOnChange<ResultDraft>(match.id, emptyResultDraft);
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
 * The planned start. The server freezes a started or finished item, so once a
 * match is running this says so rather than offering a field the server would
 * refuse — and a time changed here is the same change the schedule board makes.
 */
function TimeField({
  busy,
  locked,
  match,
  onSave,
}: {
  busy: string;
  locked: boolean;
  match: MatchDto;
  onSave: (match: MatchDto, isoOrNull: string | null) => void;
}) {
  const { locale } = useI18n();
  const control = tournamentCopy[locale].admin.control;
  const stored = toLocalInputValue(match.scheduleItem?.plannedStartAt ?? null);
  const [draft, setDraft] = useResetOnChange(stored, stored);

  if (locked || !canEditTime(match)) {
    return (
      <p className={styles.sheetHint}>
        <Lock aria-hidden="true" />
        {match.scheduleItem ? control.timeLocked : control.timeNeedsCourt}
      </p>
    );
  }

  return (
    <div className={styles.timeEdit}>
      <label className={styles.timeLabel} htmlFor={`planned-${match.id}`}>{control.timeField}</label>
      <input
        id={`planned-${match.id}`}
        type="datetime-local"
        className={styles.timeInput}
        disabled={busy === `time-${match.id}`}
        value={draft}
        onChange={(fieldEvent) => setDraft(fieldEvent.target.value)}
      />
      <CommandButton
        className={styles.timeSave}
        busy={busy === `time-${match.id}`}
        disabled={draft === stored}
        onClick={() => onSave(match, fromLocalInputValue(draft))}
      >
        {control.saveTime}
      </CommandButton>
    </div>
  );
}
