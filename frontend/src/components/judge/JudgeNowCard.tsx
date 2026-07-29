'use client';

import Link from 'next/link';
import { ArrowUpRight, Gavel } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, tournamentRound } from '@/lib/i18n/tournament';
import type { ScheduleItemDto } from '@/types/tournament';
import styles from './JudgeHome.module.css';

export type JudgeNowTarget = {
  item: ScheduleItemDto;
  /** True while the match is already running, false when it is next in line. */
  live: boolean;
  courtName: string;
  eventTitle: string;
  queueHref: string;
};

function pairName(entry: ScheduleItemDto['match']['participantA'], fallback: string) {
  return entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : fallback;
}

/**
 * The one match in front of the judge. A judge reads this standing at a court,
 * usually on a phone, so the two pairs get the largest type on the page — they
 * are what gets checked against the people actually walking on.
 */
export function JudgeNowCard({
  target,
  loading,
  hasCourts,
}: {
  target: JudgeNowTarget | null;
  loading: boolean;
  hasCourts: boolean;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const home = copy.judge.home;

  return (
    <section className={styles.now} data-idle={!target} aria-labelledby="judge-now">
      <div className={styles.nowHead}>
        <p id="judge-now" className={styles.nowKicker}>
          {target?.live ? <span className={styles.pulse} aria-hidden="true" /> : null}
          {target ? (target.live ? home.onCourt : home.upNext) : home.standby}
        </p>
        {target ? (
          <p className={styles.nowWhere}>
            <strong>{target.courtName}</strong> · {target.eventTitle}
          </p>
        ) : null}
      </div>
      <div className={styles.nowBody}>
        {loading && !target ? (
          <p className={styles.nowIdle}>{copy.common.loading}</p>
        ) : target ? (
          <>
            <p className={styles.nowRound}>
              {tournamentRound(locale, target.item.match.round)} · {copy.common.match} {target.item.match.matchNumber}
              {target.item.plannedStartAt ? ` · ${formatDate(target.item.plannedStartAt, { timeStyle: 'short' })}` : ''}
            </p>
            <div className={styles.pairs}>
              <div className={styles.side}>
                <p className={styles.sideLabel}>{copy.common.sideA}</p>
                <p className={styles.sideName}>{pairName(target.item.match.participantA, copy.common.tbd)}</p>
              </div>
              <span className={styles.versus} aria-hidden="true">{copy.common.versus}</span>
              <div className={styles.side}>
                <p className={styles.sideLabel}>{copy.common.sideB}</p>
                <p className={styles.sideName}>{pairName(target.item.match.participantB, copy.common.tbd)}</p>
              </div>
            </div>
            <div className={styles.nowActions}>
              <Link
                href={`/judge/matches/${target.item.matchId}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--dash-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#851317] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]"
              >
                <Gavel className="h-4 w-4" aria-hidden="true" />
                {target.live ? home.continueMatch : home.openMatch}
              </Link>
              <Link href={target.queueHref} className={styles.queueLink}>
                {home.openQueue}
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </>
        ) : (
          <p className={styles.nowIdle}>{hasCourts ? home.standbyDetail : home.noAssignmentDetail}</p>
        )}
      </div>
    </section>
  );
}
