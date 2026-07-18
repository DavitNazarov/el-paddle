'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowLeft, CalendarDays, Clock, MapPin, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import type { MatchDto } from '@/types/tournament';
import { InlineNotice, StatusLabel, TournamentPanel, TournamentSectionHeader } from './TournamentUI';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

type MatchDetailDto = Omit<MatchDto, 'scoreA' | 'scoreB'> & {
  scoreA: number | null;
  scoreB: number | null;
  resultVisible: boolean;
};

export function MatchDetailClient({ matchId }: { matchId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [match, setMatch] = useState<MatchDetailDto | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await apiFetch(`/api/matches/${matchId}`, { cache: 'no-store' });
    const data = await response.json() as { match?: MatchDetailDto; error?: string };
    if (!response.ok) {
      setMatch(null);
      setError(data.error ?? copy.matchDetail.notFound);
    } else {
      setError('');
      setMatch(data.match ?? null);
    }
  }, [copy.matchDetail.notFound, matchId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useTournamentRealtime({ eventId: match?.bracket?.eventId, matchId, onChange: load });

  return (
    <div className="space-y-6">
      <Link href={match?.bracket?.eventId ? `/events/${match.bracket.eventId}` : '/matches'} className="inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]">
        <ArrowLeft className="h-4 w-4" />
        {match ? copy.matchDetail.backToTournament : copy.directories.matches.title}
      </Link>
      {error ? <InlineNotice kind="error">{error}</InlineNotice> : null}
      {match ? <MatchResultSheet match={match} /> : !error ? <p className="text-[var(--padel-muted)]">{copy.matchDetail.loading}</p> : null}
    </div>
  );
}

function MatchResultSheet({ match }: { match: MatchDetailDto }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const sideA = matchSide(match, 'A');
  const sideB = matchSide(match, 'B');
  const isCompleted = match.status === 'COMPLETED';
  const isLive = match.status === 'IN_PROGRESS';
  const resultVisible = match.resultVisible && match.scoreA !== null && match.scoreB !== null;
  const winnerSide = isCompleted && resultVisible ? (match.scoreA! > match.scoreB! ? 'A' : match.scoreB! > match.scoreA! ? 'B' : null) : null;
  const scoreTitle = isCompleted ? (resultVisible ? copy.matchDetail.finalScore : copy.matchDetail.resultPending) : isLive ? copy.matchDetail.liveScore : copy.matchDetail.lineup;
  const scoreDescription = isCompleted ? (resultVisible ? copy.matchDetail.finalScoreDescription : copy.matchDetail.resultPendingDescription) : isLive ? copy.matchDetail.liveScoreDescription : copy.matchDetail.lineupDescription;
  const badge = isCompleted ? (resultVisible ? copy.matchDetail.badge : copy.matchDetail.completeBadge) : isLive ? copy.matchDetail.liveBadge : copy.matchDetail.scheduledBadge;
  const court = match.scheduleItem?.court;

  return (
    <>
      <Badge variant="gold">{badge}</Badge>
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-none md:text-6xl">
            {match.bracket?.event.title ?? copy.matchDetail.tournamentMatch}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--padel-muted)]">
            {match.bracket?.eventCategory.category.name ?? copy.matchDetail.category} · {tournamentRound(locale, match.round)} · {copy.common.match} {match.matchNumber}
          </p>
        </div>
        <StatusLabel icon={match.status === 'COMPLETED' ? 'check' : 'dot'}>{tournamentStatus(locale, match.status)}</StatusLabel>
      </div>

      <TournamentPanel className="mt-8 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40">
        <TournamentSectionHeader title={scoreTitle} description={scoreDescription} />
        <div className="grid gap-px bg-[var(--padel-line)] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <DetailSide side="A" team={sideA.team} isBye={sideA.isBye} score={(isLive || isCompleted) && resultVisible ? match.scoreA ?? undefined : undefined} winner={winnerSide === 'A'} />
          <div className="hidden bg-[var(--padel-red-2)]/70 px-4 py-8 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-muted)] md:block">{copy.matchDetail.versus}</div>
          <DetailSide side="B" team={sideB.team} isBye={sideB.isBye} score={(isLive || isCompleted) && resultVisible ? match.scoreB ?? undefined : undefined} winner={winnerSide === 'B'} />
        </div>
      </TournamentPanel>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact icon={CalendarDays} label={copy.matchDetail.event} value={match.bracket?.event.title ?? '-'} />
        <Fact icon={Trophy} label={copy.matchDetail.category} value={match.bracket?.eventCategory.category.name ?? '-'} />
        {isCompleted ? (
          <>
            <Fact icon={Activity} label={copy.matchDetail.result} value={resultVisible ? (match.resultType ? tournamentStatus(locale, match.resultType) : copy.common.completed) : copy.matchDetail.resultPendingShort} />
            <Fact icon={Clock} label={copy.matchDetail.completed} value={match.completedAt ? formatDate(match.completedAt, { dateStyle: 'long', timeStyle: 'short' }) : '-'} />
          </>
        ) : (
          <>
            <Fact icon={Clock} label={isLive ? copy.matchDetail.started : copy.matchDetail.scheduledFor} value={(isLive ? match.startedAt : match.scheduleItem?.plannedStartAt) ? formatDate((isLive ? match.startedAt : match.scheduleItem?.plannedStartAt)!, { dateStyle: 'long', timeStyle: 'short' }) : copy.matchDetail.timeTbc} />
            <Fact icon={MapPin} label={copy.matchDetail.court} value={court ? [court.name, court.location].filter(Boolean).join(' · ') : copy.matchDetail.courtTbc} />
          </>
        )}
      </div>
    </>
  );
}

function DetailSide({ side, team, isBye, score, winner }: { side: 'A' | 'B'; team?: { ownerName: string; teammateName: string; clubName?: string }; isBye: boolean; score?: number; winner: boolean }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].common;
  return (
    <section className="bg-[var(--padel-red-2)]/70 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-muted)]">{side === 'A' ? copy.sideA : copy.sideB}</p>
          <h2 className="mt-3 text-xl font-semibold leading-7 text-[var(--padel-ivory)]">
            {team ? `${team.ownerName} / ${team.teammateName}` : isBye ? copy.bye : copy.participantPending}
          </h2>
          {team?.clubName ? <p className="mt-1 text-sm text-[var(--padel-muted)]">{team.clubName}</p> : null}
        </div>
        {winner ? <Trophy className="h-5 w-5 shrink-0 text-[var(--padel-gold)]" aria-label={copy.winner} /> : null}
      </div>
      <p className="mt-10 font-mono text-7xl font-semibold tabular-nums text-[var(--padel-ivory)]">{score ?? '—'}</p>
    </section>
  );
}

function matchSide(match: MatchDetailDto, side: 'A' | 'B') {
  const snapshot = match.snapshots.find((item) => item.side === side);
  const entry = side === 'A' ? match.participantA : match.participantB;
  const team = snapshot ?? (entry ? { ownerName: entry.owner.fullName, teammateName: entry.teammate.fullName } : undefined);
  return { team, isBye: match.resultType === 'BYE' && !team };
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 p-4">
      <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold leading-6 text-[var(--padel-ivory)]">{value}</p>
    </div>
  );
}
