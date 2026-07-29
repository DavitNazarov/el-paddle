'use client';

import Link from 'next/link';
import { Gavel } from 'lucide-react';
import { StatusLabel } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';
import type { ScheduleItemDto } from '@/types/tournament';
import styles from './JudgeHome.module.css';

function pairName(entry: ScheduleItemDto['match']['participantA'], fallback: string) {
  return entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : fallback;
}

/**
 * The court queue in playing order. Exactly one row carries an open action —
 * the queue is worked in order, and offering a second would invite a judge to
 * start a match the server will refuse.
 */
export function JudgeQueueList({
  items,
  openItemId,
  liveItemId,
}: {
  items: ScheduleItemDto[];
  openItemId: string | null;
  liveItemId: string | null;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const queueCopy = copy.judge.queue;
  const ordered = [...items].sort((left, right) => left.queuePosition - right.queuePosition);

  return (
    <ol>
      {ordered.map((item) => {
        const isOpen = openItemId === item.id;
        const isDone = item.status === 'COMPLETED';
        return (
          <li key={item.id} className={styles.queueItem} data-open={isOpen} data-done={isDone}>
            <span className={styles.queuePosition} aria-hidden="true">{item.queuePosition}</span>
            <div className={styles.queueText}>
              <p className={styles.queueTitle}>
                <span className="sr-only">{copy.common.queue} {item.queuePosition} · </span>
                {tournamentRound(locale, item.match.round)} · {copy.common.match} {item.match.matchNumber}
              </p>
              <p className={styles.queuePairs}>
                {pairName(item.match.participantA, copy.common.tbd)}
                {isDone ? (
                  <span className={styles.queueScore}> {item.match.scoreA}–{item.match.scoreB} </span>
                ) : ` ${copy.common.versus} `}
                {pairName(item.match.participantB, copy.common.tbd)}
              </p>
            </div>
            <div className={styles.queueActions}>
              <StatusLabel icon={isDone ? 'check' : 'dot'}>{tournamentStatus(locale, item.status)}</StatusLabel>
              {isOpen ? (
                <Link href={`/judge/matches/${item.matchId}`} className={styles.queueOpen}>
                  <Gavel className="h-4 w-4" aria-hidden="true" />
                  {liveItemId === item.id ? queueCopy.continueMatch : queueCopy.openMatch}
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
