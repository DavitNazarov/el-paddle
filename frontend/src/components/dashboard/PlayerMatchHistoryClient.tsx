'use client';

import { useEffect, useState } from 'react';
import { Award, Handshake, Medal, Trophy } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { PublicUser } from '@/types/auth';
import { PlayerShell } from './PlayerShell';
import { MatchHistoryClient } from '@/components/tournament/MatchHistoryClient';
import { EmptyTournamentState, InlineNotice, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import styles from './PlayerHome.module.css';

type PlayerStats = {
  matches: Array<{ id: string; round: string; won: boolean; eventTitle: string }>;
  currentStreak: { kind: 'W' | 'L'; count: number } | null;
  bestWinStreak: number;
  bestFinish: { kind: 'CHAMPION' | 'FINALIST' | 'SEMIFINALIST' | 'COMPETED'; eventTitle: string } | null;
  partners: Array<{ name: string; wins: number; losses: number }>;
};

/**
 * Milestones are computed, never stored: they are a reading of the record, and
 * recomputing keeps them honest when a result is corrected. Only reached ones
 * render — a wall of grey padlocks tells a new player they are behind.
 */
function reachedMilestones(
  stats: PlayerStats,
  copy: (typeof tournamentCopy)['en']['playerMatches'] | (typeof tournamentCopy)['ka']['playerMatches'],
) {
  const wins = stats.matches.filter((match) => match.won).length;
  const playedFinal = stats.matches.some((match) => match.round === 'FINAL');
  const championOf = stats.bestFinish?.kind === 'CHAMPION' ? stats.bestFinish.eventTitle : null;
  const reached: string[] = [];
  if (stats.matches.length >= 1) reached.push(copy.milestoneFirstMatch);
  if (wins >= 1) reached.push(copy.milestoneFirstWin);
  if (wins >= 5) reached.push(copy.milestoneWins5);
  if (wins >= 10) reached.push(copy.milestoneWins10);
  if (wins >= 25) reached.push(copy.milestoneWins25);
  if (playedFinal) reached.push(copy.milestoneFirstFinal);
  if (championOf) reached.push(fillTemplate(copy.milestoneChampion, { event: championOf }));
  return reached;
}

function PlayerRecordPanel() {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].playerMatches;
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiFetch('/api/me/stats', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('stats'))))
      .then((data: { stats: PlayerStats }) => {
        if (!cancelled) {
          setStats(data.stats);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The record is a bonus on top of the match list — if it cannot load, one
  // quiet line says so and the page still works.
  if (failed) return <InlineNotice kind="warning">{copy.statsLoadError}</InlineNotice>;
  if (!loaded || !stats) return null;
  if (!stats.matches.length) {
    return (
      <TournamentPanel>
        <EmptyTournamentState title={copy.emptyRecord} />
      </TournamentPanel>
    );
  }

  const finishLabel =
    stats.bestFinish?.kind === 'CHAMPION'
      ? copy.finishChampion
      : stats.bestFinish?.kind === 'FINALIST'
        ? copy.finishFinalist
        : stats.bestFinish?.kind === 'SEMIFINALIST'
          ? copy.finishSemifinalist
          : copy.finishCompeted;
  const milestones = reachedMilestones(stats, copy);

  return (
    <TournamentPanel labelledBy="player-record">
      <TournamentSectionHeader id="player-record" title={copy.recordTitle} />
      <div className="p-4 sm:p-5">
        <div className={styles.record}>
          <div className={styles.recordCell}>
            <p className={styles.recordValue}>
              {stats.currentStreak
                ? fillTemplate(
                    stats.currentStreak.kind === 'W' ? copy.winStreakValue : copy.lossStreakValue,
                    { count: stats.currentStreak.count },
                  )
                : '—'}
            </p>
            <p className={styles.recordLabel}>{copy.currentStreak}</p>
          </div>
          <div className={styles.recordCell}>
            <p className={styles.recordValue}>{stats.bestWinStreak || '—'}</p>
            <p className={styles.recordLabel}>{copy.bestStreak}</p>
          </div>
          <div className={styles.recordCell}>
            <p className={styles.recordValue}>{stats.bestFinish ? finishLabel : '—'}</p>
            <p className={styles.recordLabel}>{copy.bestFinish}</p>
          </div>
          <div className={styles.recordCell}>
            <p className={styles.recordValue}>{stats.matches.length}</p>
            <p className={styles.recordLabel}>{tournamentCopy[locale].playerHome.matches}</p>
          </div>
        </div>

        {milestones.length ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dash-faint)]">
              {copy.milestonesTitle}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {milestones.map((milestone, index) => (
                <li
                  key={milestone}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[rgba(168,103,18,0.28)] bg-[rgba(168,103,18,0.07)] px-3 text-xs font-semibold text-[#7a5410]"
                >
                  {index === milestones.length - 1 ? (
                    <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : milestone.includes('5') || milestone.includes('10') ? (
                    <Medal className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {milestone}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {stats.partners.length ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dash-faint)]">
              {copy.partnersTitle}
            </p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {stats.partners.map((partner) => (
                <li
                  key={partner.name}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--dash-border)] bg-[#faf6f3] px-3 text-sm"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 text-[var(--dash-text)]">
                    <Handshake className="h-4 w-4 shrink-0 text-[var(--dash-faint)]" aria-hidden="true" />
                    <span className="truncate">{partner.name}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-[var(--dash-muted)]">
                    {fillTemplate(copy.partnerRecord, { wins: partner.wins, losses: partner.losses })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

      </div>
    </TournamentPanel>
  );
}

export function PlayerMatchHistoryClient({ user }: { user: PublicUser }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].playerMatches;
  return (
    <PlayerShell user={user} title={copy.title} description={copy.description}>
      <div className="space-y-5">
        <PlayerRecordPanel />
        <MatchHistoryClient endpoint="/api/me/matches" tone="dashboard" viewerUserId={user.id} />
      </div>
    </PlayerShell>
  );
}
