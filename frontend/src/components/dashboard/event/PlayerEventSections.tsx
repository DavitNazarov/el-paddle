'use client';

import { CalendarClock, Check, MapPin, X } from 'lucide-react';
import type { OpponentRequestDto } from '@/types/tournament';
import {
  CommandButton,
  EmptyTournamentState,
  StatusLabel,
  TournamentPanel,
  TournamentSectionHeader,
} from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';
import {
  canRespond,
  canWithdraw,
  didWin,
  hasScore,
  opponentOf,
  requestReason,
  type PlayerMatch,
} from './playerEventModel';
import styles from './PlayerEvent.module.css';

function pairText(entry: { owner: { fullName: string }; teammate: { fullName: string } }) {
  return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
}

/**
 * Opponent requests, from the reader's side. Only the transitions their own
 * request is actually in get a button — the server refuses the rest, and a
 * player reading a refusal as a bug is worse than not offering it.
 */
export function RequestPanel({
  title,
  description,
  side,
  requests,
  busy,
  emptyTitle,
  onAccept,
  onRefuse,
  onWithdraw,
  actions,
}: {
  title: string;
  description?: string;
  side: 'sent' | 'received';
  requests: OpponentRequestDto[];
  busy: string;
  emptyTitle: string;
  onAccept?: (request: OpponentRequestDto) => void;
  onRefuse?: (request: OpponentRequestDto) => void;
  onWithdraw?: (request: OpponentRequestDto) => void;
  actions?: React.ReactNode;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].playerEvent;

  return (
    <TournamentPanel>
      <TournamentSectionHeader title={title} description={description} actions={actions} />
      {requests.length ? (
        <ul className={styles.requestList}>
          {requests.map((request) => {
            const reason = requestReason(request);
            const awaiting = side === 'received' && canRespond(request);
            return (
              <li key={request.id} className={styles.requestRow} data-awaiting={awaiting}>
                <div className="min-w-0">
                  <p className={styles.requestPair}>{pairText(opponentOf(request, side))}</p>
                  <div className={styles.requestMeta}>
                    <StatusLabel
                      icon={
                        request.status.includes('REFUSED') || request.status.includes('REJECTED')
                          ? 'warning'
                          : request.status.includes('APPROVED') || request.status.includes('APPLIED')
                            ? 'check'
                            : 'dot'
                      }
                    >
                      {tournamentStatus(locale, request.status)}
                    </StatusLabel>
                  </div>
                  {reason ? <p className={styles.requestReason}>{reason}</p> : null}
                </div>
                <div className={styles.requestActions}>
                  {side === 'received' && canRespond(request) ? (
                    <>
                      <CommandButton
                        tone="primary"
                        busy={busy === `accept-${request.id}`}
                        onClick={() => onAccept?.(request)}
                      >
                        {copy.accept}
                      </CommandButton>
                      <CommandButton busy={busy === `refuse-${request.id}`} onClick={() => onRefuse?.(request)}>
                        {copy.refuse}
                      </CommandButton>
                    </>
                  ) : null}
                  {side === 'sent' && canWithdraw(request) ? (
                    <CommandButton busy={busy === `withdraw-${request.id}`} onClick={() => onWithdraw?.(request)}>
                      {copy.withdraw}
                    </CommandButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyTournamentState title={emptyTitle} />
      )}
    </TournamentPanel>
  );
}

/**
 * The reader's own matches, running one first. Their own pair is marked so they
 * do not have to work out which side they are.
 */
export function PlayerMatchPanel({ matches, emptyTitle, emptyDetail }: { matches: PlayerMatch[]; emptyTitle: string; emptyDetail: string }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const player = copy.playerEvent;

  return (
    <TournamentPanel>
      <TournamentSectionHeader title={player.yourMatches} description={player.yourMatchesDescription} />
      {matches.length ? (
        <ul className={styles.matchList}>
          {matches.map((entry) => {
            const { match, side } = entry;
            const won = didWin(entry);
            const mine = side === 'A' ? match.participantA : match.participantB;
            const theirs = side === 'A' ? match.participantB : match.participantA;
            const myScore = side === 'A' ? match.scoreA : match.scoreB;
            const theirScore = side === 'A' ? match.scoreB : match.scoreA;

            return (
              <li key={match.id} className={styles.matchRow} data-live={match.status === 'IN_PROGRESS'}>
                <div className={styles.matchMain}>
                  <p className={styles.matchRound}>
                    {tournamentRound(locale, match.round)} · {copy.common.match} {match.matchNumber}
                  </p>
                  <p className={styles.matchPair}>
                    <span className={styles.you}>{mine ? pairText(mine) : copy.common.tbd}</span>
                    {' '}
                    {copy.common.versus}
                    {' '}
                    {theirs ? pairText(theirs) : copy.common.tbd}
                  </p>
                  <p className={styles.matchWhen}>
                    <span>
                      <CalendarClock aria-hidden="true" />
                      {entry.plannedStartAt
                        ? formatDate(entry.plannedStartAt, { dateStyle: 'medium', timeStyle: 'short' })
                        : player.timeNotSet}
                    </span>
                    {entry.courtName ? (
                      <span>
                        <MapPin aria-hidden="true" />
                        {entry.courtName}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className={styles.matchAside}>
                  {hasScore(match) ? (
                    <p className={styles.score}>
                      {myScore}<span aria-hidden="true">–</span>{theirScore}
                    </p>
                  ) : (
                    <StatusLabel>{tournamentStatus(locale, match.status)}</StatusLabel>
                  )}
                  {won === null ? null : (
                    <span className={styles.outcome} data-won={won}>
                      {won ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
                      {won ? player.youWon : player.youLost}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyTournamentState title={emptyTitle} detail={emptyDetail} />
      )}
    </TournamentPanel>
  );
}

export const playerEventPageClassName = styles.page;
export const requestsGridClassName = styles.requests;
export const playerNoteClassName = styles.note;
